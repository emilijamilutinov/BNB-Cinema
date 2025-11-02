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
  // dropdown termine:
  screenings: any[] = [];
  selectedScreeningId: number | null = null;

  // Sedišta
  seats: Seat[] = [];
  selectedSeatIds: number[] = [];

  // cene se sada uzimaju iz projekcije (default ako još nije izabrana)
  prices: Record<SeatType, number> = { REGULAR: 4.00, VIP: 6.00, DISABLED: 4.00 };

  private isBrowser = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    const filmTitle = this.route.snapshot.paramMap.get('title');

    // Učitavanje filma sa spoljnog API-ja (tvoj postojeći pristup)
    this.filmoviService.getFilmovi().subscribe((filmovi) => {
      this.film = filmovi.find(
        (f: any) => f.title?.toLowerCase() === filmTitle?.toLowerCase()
      );
      this.initSeats(); // nacrtaj praznu salu
      this.loadScreeningsForLocalFilm(); // pokušaj da nađeš lokalni film i njegove termine
    });
  }

  // pokuša da mapira naslov na lokalni film iz baze i učita termine
  private loadScreeningsForLocalFilm(): void {
    if (!this.film?.title) return;
    this.filmoviService.getFilms().subscribe({
      next: (locals) => {
        const title = (this.film.title || '').trim().toLowerCase();
        const found = (locals || []).find((x: any) => (x?.title || '').trim().toLowerCase() === title);
        if (!found) return; // film nije importovan u lokalnu bazu
        const localId = found.id;

        this.filmoviService.getScreenings(localId).subscribe({
          next: (rows) => {
            this.screenings = rows || [];
          },
          error: () => this.screenings = []
        });
      }
    });
  }

  // kada korisnik izabere termin iz select-a
  onPickScreening(id: string | number | null): void {
    // ngModel može dati string – normalizuj:
    const sid = id === null ? null : Number(id);
    this.selectedScreeningId = Number.isFinite(sid as number) ? (sid as number) : null;

    this.selectedSeatIds = [];
    this.initSeats();

    if (this.selectedScreeningId) {
      // nadji projekciju da uzmeš cene
      const sc = this.screenings.find(s => s.id === this.selectedScreeningId);
      if (sc) {
        this.prices.REGULAR = Number(sc.base_price_std ?? 4);
        this.prices.VIP     = Number(sc.base_price_vip ?? 6);
      }
      this.restoreTakenSeatsFromAPI();
    }
  }

  private restoreTakenSeatsFromAPI(): void {
    if (!this.selectedScreeningId) return;

    this.filmoviService.getTakenSeatsByScreening(this.selectedScreeningId)
      .subscribe((takenCodes: string[]) => {
        const taken = new Set(takenCodes);
        this.seats = this.seats.map(s => {
          const code = `${s.row}${s.num}`;
          return { ...s, status: taken.has(code) ? 'TAKEN' : 'FREE' };
        });
        this.selectedSeatIds = this.selectedSeatIds.filter(id => {
          const seat = this.seats.find(x => x.id === id)!;
          return seat.status !== 'TAKEN';
        });
      });
  }

  /** 5 x 8; kolone 4 i 5 su VIP */
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
    if (!this.selectedScreeningId) { alert('Izaberite termin.'); return; }
    if (this.selectedSeatIds.length === 0) { alert('Izaberite bar jedno sedište.'); return; }

    const seatsMin = this.selectedSeatIds
      .map(id => this.seats.find(s => s.id === id)!)
      .map(s => ({ row: s.row, num: s.num }));

    const payload = {
      film_title: this.film.title ?? null, // opciono – ostavljamo radi kompatibilnosti
      datum: null,                         // više ga ne koristimo kada imamo screening_id
      screening_id: this.selectedScreeningId,
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
