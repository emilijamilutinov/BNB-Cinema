import { Component, OnInit, Output, EventEmitter, Inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilmoviService } from '../filmovi/filmovi.service';

type SeatType = 'REGULAR' | 'VIP' | 'DISABLED';
type SeatStatus = 'FREE' | 'TAKEN';

interface Seat {
  id: number;
  row: string;
  num: number;
  type: SeatType;
  status: SeatStatus;
}

@Component({
  selector: 'app-rezervacija',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rezervacija.component.html',
  styleUrls: ['./rezervacija.component.css']
})
export class RezervacijaComponent implements OnInit {
  @Output() korpaOsvezena = new EventEmitter<void>();

  film: any = null;
  korisnickoIme = '';
  datum = '';

  // Sedišta
  seats: Seat[] = [];
  selectedSeatIds: number[] = [];
  prices: Record<SeatType, number> = { REGULAR: 4.00, VIP: 6.00, DISABLED: 4.00 };

  isBrowser = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    const filmTitle = this.route.snapshot.paramMap.get('title'); // koristiš title u URL-u

    this.filmoviService.getFilmovi().subscribe((filmovi) => {
      this.film = filmovi.find(
        (f: any) => f.title.toLowerCase() === filmTitle?.toLowerCase()
      );
      // nakon što nađemo film, generiši (ili učitaj) raspored sedišta
      this.initSeats();
      this.restoreTakenSeatsForThisFilmAndDate(); // ako želiš da čuvaš već zauzeta sedišta lokalno
    });
  }

  /** Demo generacija sale: 5 redova × 8 sedišta; kolone 4 i 5 su VIP */
  private initSeats(): void {
    const rows = ['A','B','C','D','E'];
    const perRow = 8;
    const seats: Seat[] = [];
    let id = 1;
    for (const r of rows) {
      for (let n = 1; n <= perRow; n++) {
        seats.push({
          id: id++,
          row: r,
          num: n,
          type: (n === 4 || n === 5) ? 'VIP' : 'REGULAR',
          status: 'FREE'
        });
      }
    }
    this.seats = seats;
  }

  /** Ako želiš da simuliraš “zauzeto” po filmu & datumu u localStorage-u */
  private restoreTakenSeatsForThisFilmAndDate(): void {
    if (!this.isBrowser) return;
    const key = this.takenKey();
    const taken: number[] = JSON.parse(localStorage.getItem(key) || '[]');
    const takenSet = new Set(taken);
    this.seats = this.seats.map(s => ({ ...s, status: takenSet.has(s.id) ? 'TAKEN' : 'FREE' }));
    // ako su neki već zauzeti, ukloni ih iz selekcije
    this.selectedSeatIds = this.selectedSeatIds.filter(id => !takenSet.has(id));
  }

  private takenKey(): string {
    // ključ u LS za "zauzeta" po naslovu filma + datumu projekcije
    return `taken_${this.film?.title || 'film'}_${this.datum || 'no-date'}`;
  }

  toggleSeat(seat: Seat): void {
    if (seat.status === 'TAKEN') return;

    const idx = this.selectedSeatIds.indexOf(seat.id);
    if (idx >= 0) {
      this.selectedSeatIds.splice(idx, 1);
    } else {
      this.selectedSeatIds.push(seat.id);
    }
  }

  isSelected(seat: Seat): boolean {
    return this.selectedSeatIds.includes(seat.id);
  }

  seatPrice(seat: Seat): number {
    return this.prices[seat.type];
  }

  get totalPrice(): number {
    return this.selectedSeatIds
      .map(id => this.seats.find(s => s.id === id)!)
      .reduce((sum, s) => sum + this.seatPrice(s), 0);
  }

  /** Potvrda – dodaje u “korpu” u LS + (opciono) obeleži izabrana sedišta kao zauzeta */
  potvrdiRezervaciju(): void {
    if (!this.film) { alert('Film nije učitan.'); return; }
    if (!this.korisnickoIme.trim()) { alert('Unesite ime.'); return; }
    if (!this.datum) { alert('Izaberite datum.'); return; }
    if (this.selectedSeatIds.length === 0) { alert('Izaberite bar jedno sedište.'); return; }

    const selectedSeats = this.selectedSeatIds
      .map(id => this.seats.find(s => s.id === id)!)
      .map(s => ({ row: s.row, num: s.num, type: s.type, price: this.seatPrice(s) }));

    const rezervacija = {
      film: { title: this.film.title, poster: this.film.poster },
      korisnickoIme: this.korisnickoIme.trim(),
      datum: this.datum,
      seats: selectedSeats,
      total: this.totalPrice
    };

    if (this.isBrowser) {
      // 1) dodaj u korpu
      const korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
      korpa.push(rezervacija);
      localStorage.setItem('korpa', JSON.stringify(korpa));

      // 2) obeleži kao zauzeta (da drugi put budu siva u ovoj demo varijanti)
      const key = this.takenKey();
      const prevTaken: number[] = JSON.parse(localStorage.getItem(key) || '[]');
      const newTaken = Array.from(new Set([...prevTaken, ...this.selectedSeatIds]));
      localStorage.setItem(key, JSON.stringify(newTaken));
    }

    this.korpaOsvezena.emit();
    alert(`"${this.film.title}" je dodat u korpu!`);
    this.router.navigate(['/filmovi']);
  }
}
