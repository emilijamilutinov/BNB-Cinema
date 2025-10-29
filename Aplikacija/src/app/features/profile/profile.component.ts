import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
//import { AuthService } from '../../auth.service'; // ← nije potreban ovde
import { jwtDecode } from 'jwt-decode';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, NgIf, NgFor, CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  username = 'Nepoznat korisnik';
  email = 'Nepoznata email adresa';
  newUsername = '';
  newPassword = '';
  reservations: any[] = [];

  isBrowser: boolean;

  constructor(
    private router: Router,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadUserData();
      this.loadReservations();
    }
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

  loadReservations(): void {
    if (!this.isBrowser) return;

    this.http.get<any[]>(`http://localhost:4000/api/rezervacije`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
}).subscribe({
  next: (rows) => {
    this.reservations = rows.map(r => ({
      ...r,
      seats: JSON.parse(r.seats_json || '[]'),   // array sedišta
      datum: r.datum.split('T')[0] ?? r.datum
    }));
  },
  error: () => this.reservations = []
});

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
      // backend vraća novi token ako je promenjen username
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
