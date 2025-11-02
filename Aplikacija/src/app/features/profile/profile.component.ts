import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FilmoviService } from '../filmovi/filmovi.service';


type ReservationVM = {
  id: number;
  film_title: string;
  seats_json: any[] | string;
  seats: { row: string; num: number }[];
  seats_count: number;
  total: number | null;
  datum?: string | null;         // fallback (staro polje)
  hall?: string | null;          // Sala 1 / Sala 2
  starts_at?: string | null;     // pun ISO/SQL datetime ako backend šalje
  starts_date?: string | null;   // 2025-11-03
  starts_time?: string | null;   // 20:00
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  username = 'Nepoznat korisnik';
  email = 'Nepoznata email adresa';
  newUsername = '';
  newPassword = '';

  // Tabela u profilu čita iz ovoga:
  reservations: ReservationVM[] = [];

  isBrowser: boolean;

  constructor(
    private router: Router,
    private http: HttpClient,
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadReservations();
  }

  /** Normalizacija jedne rezervacije (sala/vreme/sedista/total) */
  private normalizeReservation(r: any): ReservationVM {
    // seats: uvek kao niz objekata {row,num}
    const seats = Array.isArray(r.seats_json)
      ? r.seats_json
      : (() => {
          try { return JSON.parse(r.seats_json || '[]'); }
          catch { return []; }
        })();

    // Sala i vreme (podržava više varijanti sa servera)
    let hall: string | null = r.hall ?? null;
let startsDate: string | null = r.starts_date ?? null;
let startsTime: string | null = r.starts_time ?? null;

// 1) Ako imamo starts_at ("YYYY-MM-DD HH:mm:ss") – izreži
if (r.starts_at && (!startsDate || !startsTime)) {
  const iso = String(r.starts_at).replace(' ', 'T'); // "YYYY-MM-DDTHH:mm:ss"
  if (!startsDate) startsDate = iso.slice(0, 10);
  if (!startsTime) startsTime = iso.slice(11, 16);
}

// 2) Ako i dalje nema datuma, koristi staro polje 'datum'
if (!startsDate && r.datum) {
  startsDate = String(r.datum).slice(0, 10);
}


    return {
      id: Number(r.id),
      film_title: r.film_title,
      seats_json: r.seats_json,
      seats,
      seats_count: seats.length,
      total: (r.total ?? r.total_eur ?? null) !== null ? Number(r.total ?? r.total_eur) : null,
      datum: r.datum ?? null,
      hall: hall ?? null,
      starts_at: r.starts_at ?? null,
      starts_date: startsDate ?? null,
      starts_time: startsTime ?? null
    };
  }

  /** Poziv backend-a preko servisa; puni tabelu */
  loadReservations(): void {
    if (!this.isBrowser) return;
    this.filmoviService.getMyReservations().subscribe({
      next: rows => {
        this.reservations = (rows || []).map(r => this.normalizeReservation(r));
      },
      error: () => { this.reservations = []; }
    });
  }

  private authHeaders(): HttpHeaders {
    if (!this.isBrowser) return new HttpHeaders();
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadUserData(): void {
    if (!this.isBrowser) return;
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.username = decoded.username || 'Korisnik';
        this.email = decoded.email || 'Nepoznata email adresa';
      } catch (error) {
        console.error('Greška pri dekodiranju tokena:', error);
        this.username = 'Nepoznat korisnik';
        this.email = '';
      }
    }
  }

  removeReservation(reservationId: number): void {
    if (!this.isBrowser) return;
    if (!confirm('Da li ste sigurni da želite da uklonite ovu rezervaciju?')) return;

    this.http.delete(`http://localhost:4000/api/rezervacije/${reservationId}`, {
      headers: this.authHeaders()
    }).subscribe({
      next: () => {
        this.reservations = this.reservations.filter(rez => rez.id !== reservationId);
      },
      error: (error) => {
        console.error('Greška pri brisanju rezervacije:', error);
        alert('Došlo je do greške pri brisanju rezervacije.');
      }
    });
  }

  updateProfile(): void {
    if (!this.isBrowser) return;

    if (!this.newUsername && !this.newPassword) {
      alert('Molimo unesite novo korisničko ime ili novu šifru.');
      return;
    }
    if (this.newPassword && this.newPassword.length < 6) {
      alert('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }

    const payload: any = {};
    if (this.newUsername) payload.username = this.newUsername.trim();
    if (this.newPassword) payload.password = this.newPassword;

    this.http.patch('http://localhost:4000/api/user', payload, {
      headers: this.authHeaders()
    }).subscribe({
      next: (res: any) => {
        if (res?.token) localStorage.setItem('token', res.token);
        alert('Podaci su uspešno ažurirani!');
        this.loadUserData();
        this.newUsername = '';
        this.newPassword = '';
      },
      error: (err) => {
        console.error('Greška pri ažuriranju profila:', err);
        alert(err?.error?.message || 'Greška pri ažuriranju podataka.');
      }
    });
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      this.router.navigate(['/login']);
    }
  }
}
