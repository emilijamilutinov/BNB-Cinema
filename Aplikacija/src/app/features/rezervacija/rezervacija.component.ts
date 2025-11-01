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
  const filmTitle = this.route.snapshot.paramMap.get('title');

  this.filmoviService.getFilmovi().subscribe((filmovi) => {
    this.film = filmovi.find(
      (f: any) => f.title.toLowerCase() === filmTitle?.toLowerCase()
    );
    this.initSeats();                // nacrtaj praznu salu
    
  });
  }


   
  onDateChanged(): void {
  if (!this.film || !this.datum) return;
  this.initSeats();                // reset sale
  this.selectedSeatIds = [];       // reset izbora
  this.restoreTakenSeatsFromAPI(); 
}
private restoreTakenSeatsFromAPI(): void {
  if (!this.film?.title || !this.datum) return;

  this.filmoviService.getTakenSeats(this.film.title, this.datum)
    .subscribe((takenCodes: string[]) => {
      const taken = new Set(takenCodes); // npr. ["A4","B7"]

      this.seats = this.seats.map(s => {
        const code = `${s.row}${s.num}`; // isti format kao seat_code u bazi
        return { ...s, status: taken.has(code) ? 'TAKEN' : 'FREE' };
      });

      // ako je nešto u međuvremenu postalo zauzeto, skini iz selekcije
      this.selectedSeatIds = this.selectedSeatIds.filter(id => {
        const seat = this.seats.find(x => x.id === id)!;
        return seat.status !== 'TAKEN';
      });
    });
}
//i ovo je dodato




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

  
  


  toggleSeat(seat: Seat): void {
  if (!this.datum) { alert('Prvo izaberite datum.'); return; }
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
  if (!this.datum) { alert('Izaberite datum.'); return; }
  if (this.selectedSeatIds.length === 0) { alert('Izaberite bar jedno sedište.'); return; }

  
  const seatsMin = this.selectedSeatIds
    .map(id => this.seats.find(s => s.id === id)!)
    .map(s => ({ row: s.row, num: s.num }));

  const payload = {
    film_title: this.film.title,
    datum: this.datum,
    seats: seatsMin,
    total: this.totalPrice, // ili 0, pa račun na serveru (bezbednije)
  };

  this.filmoviService.postRezervacija(payload).subscribe({
    next: () => {
      this.korpaOsvezena.emit();
      alert(`"${this.film.title}" je uspešno rezervisan!`);
      this.router.navigate(['/filmovi']);
    },
    error: (err) => {
      alert(err?.error?.message || 'Greška pri potvrdi');
      // neko je u međuvremenu zauzeo sedište → osveži stanje iz baze
      if (err?.status === 409) this.restoreTakenSeatsFromAPI();
    }
  });
}

}
