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

  // film iz spoljnog API-ja (za prikaz)
  film: any = null;

  // film iz lokalne baze (radi termina)
  filmLocalId: number | null = null;
  screenings: any[] = [];
  selectedScreeningId: number | null = null;   // biramo termin

  korisnickoIme = '';
  datum = '';                                   // YYYY-MM-DD (iz izabranog termina)

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
    const filmTitle = this.route.snapshot.paramMap.get('title') || '';

    // 1) prikaži podatke o filmu (spoljni API – kao do sada)
    this.filmoviService.getFilmovi().subscribe((filmovi) => {
      this.film = filmovi.find(
        (f: any) => (f.title || '').toLowerCase() === filmTitle.toLowerCase()
      ) || null;
      this.initSeats(); // prazna sala dok ne izaberemo termin
    });

    // 2) nađi ID iz lokalne baze po naslovu i učitaj termine
    this.filmoviService.getFilms().subscribe({
      next: (locals) => {
        const found = (locals || []).find(
          (x: any) => (x?.title || '').trim().toLowerCase() === filmTitle.toLowerCase()
        );
        if (found) {
          this.filmLocalId = found.id;
          this.loadScreenings();
        } else {
          this.filmLocalId = null;
          this.screenings = [];
        }
      },
      error: () => {
        this.filmLocalId = null;
        this.screenings = [];
      }
    });
  }

  /** učitaj sve termine za naš lokalni film */
  private loadScreenings(): void {
    if (!this.filmLocalId) { this.screenings = []; return; }
    this.filmoviService.getScreenings(this.filmLocalId).subscribe({
      next: (rows) => this.screenings = rows || [],
      error: () => this.screenings = []
    });
  }

  /** kad korisnik izabere termin iz dropdown-a */
  onPickScreening(): void {
    const id = Number(this.selectedScreeningId);
    if (!id) {
      this.datum = '';
      this.selectedSeatIds = [];
      this.initSeats();
      return;
    }
    const s = this.screenings.find(x => x.id === id);
    // datum (yyyy-mm-dd) iz starts_at -> "YYYY-MM-DD HH:mm:ss"
    this.datum = (s?.starts_at || '').slice(0, 10);

    // osveži salu i povuci zauzeta sedišta za taj (film, datum)
    this.initSeats();
    this.selectedSeatIds = [];
    this.restoreTakenSeatsFromAPI();
  }

  /** generacija sale: 5 redova × 8 sedišta; kolone 4 i 5 su VIP */
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

  /** povuci zauzeta sedišta iz BE po (film_title, datum) */
  private restoreTakenSeatsFromAPI(): void {
    if (!this.film?.title || !this.datum) return;

    this.filmoviService.getTakenSeats(this.film.title, this.datum)
      .subscribe((takenCodes: string[]) => {
        const taken = new Set(takenCodes); // npr. ["A4","B7"]

        this.seats = this.seats.map(s => {
          const code = `${s.row}${s.num}`;
          return { ...s, status: taken.has(code) ? 'TAKEN' : 'FREE' };
        });

        // izbaci iz already-selected sve što je postalo zauzeto
        this.selectedSeatIds = this.selectedSeatIds.filter(id => {
          const seat = this.seats.find(x => x.id === id)!;
          return seat.status !== 'TAKEN';
        });
      });
  }

  toggleSeat(seat: Seat): void {
    if (!this.selectedScreeningId) { alert('Izaberite termin.'); return; }
    if (seat.status === 'TAKEN') return;

    const idx = this.selectedSeatIds.indexOf(seat.id);
    if (idx >= 0) this.selectedSeatIds.splice(idx, 1);
    else this.selectedSeatIds.push(seat.id);
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

  potvrdiRezervaciju(): void {
    if (!this.film) { alert('Film nije učitan.'); return; }
    if (!this.korisnickoIme.trim()) { alert('Unesite ime.'); return; }
    if (!this.selectedScreeningId || !this.datum) { alert('Izaberite termin.'); return; }
    if (this.selectedSeatIds.length === 0) { alert('Izaberite bar jedno sedište.'); return; }

    const seatsMin = this.selectedSeatIds
      .map(id => this.seats.find(s => s.id === id)!)
      .map(s => ({ row: s.row, num: s.num }));

    const payload = {
      film_title: this.film.title,  // BE čuva po nazivu + datumu
      datum: this.datum,            // iz izabranog termina
      seats: seatsMin,
      total: this.totalPrice,
    };

    this.filmoviService.postRezervacija(payload).subscribe({
      next: () => {
        this.korpaOsvezena.emit();
        alert(`"${this.film.title}" je uspešno rezervisan!`);
        this.router.navigate(['/filmovi']);
      },
      error: (err) => {
        alert(err?.error?.message || 'Greška pri potvrdi');
        if (err?.status === 409) this.restoreTakenSeatsFromAPI();
      }
    });
  }
}
