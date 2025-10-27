// src/app/app.component.ts
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  title = 'BNB Cinema';
  footerUrl = '/about';
  footerLink = 'Saznaj više';

  korpa: any[] = [];
  cartOpen = false;
  isLoggedIn = false;
  username = '';
  email = '';

  constructor(@Inject(PLATFORM_ID) private platformId: Object,
              private router: Router) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.ucitajKorpu();
      this.updateLoginStatus();
      window.addEventListener('storage', () => this.ucitajKorpu());
    }
  }

  toggleCart() { this.cartOpen = !this.cartOpen; }

  ucitajKorpu() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
  }

  onActivate(event: any): void {
    this.ucitajKorpu();
    this.updateLoginStatus();
  }

  updateLoginStatus() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = localStorage.getItem('token');
    this.isLoggedIn = !!token;
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.username = decoded.username || 'Korisnik';
        this.email = decoded.email || '';
      } catch {
        this.username = 'Korisnik';
        this.email = '';
      }
    }
  }

  potvrdiSveRezervacije() {
    // za sada samo očisti korpu (dok ne napravimo backend rutu)
    if (this.korpa.length === 0) {
      alert('Vaša korpa je prazna.');
      return;
    }
    if (!this.isLoggedIn) {
      alert('Morate biti prijavljeni da biste potvrdili rezervacije.');
      return;
    }
    localStorage.removeItem('korpa');
    this.korpa = [];
    this.cartOpen = false;
    alert('Rezervacije potvrđene (demo).');
  }

  ukloniIzKorpe(rezervacija: any) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.korpa = this.korpa.filter(item => item !== rezervacija);
    localStorage.setItem('korpa', JSON.stringify(this.korpa));
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
    }
    this.isLoggedIn = false;
    this.username = '';
    this.email = '';
    this.router.navigate(['/login']);
  }
}
