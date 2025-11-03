import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FilmoviService } from '../filmovi/filmovi.service';

type ReservationVM = {
  id: number;
  film_title: string;
  seats_json?: string;
  seats_count?: number;
  hall?: string;
  starts_at?: string;
  starts_date?: string;
  starts_time?: string;
  datum?: string;
  total?: number;
};

type FavCard = { title: string; poster: string };

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit {
  // --- Nalog
  username = '';
  email = '';
  newUsername = '';
  newPassword = '';

  // --- Tabovi
  activeTab: 'reservations' | 'favorites' = 'reservations';

  // --- Rezervacije
  reservations: ReservationVM[] = [];

  // --- Omiljeni
  favorites: { film_title: string }[] = [];
  favCards: FavCard[] = [];               // -> ono što šablon prikazuje (naslov + poster URL)
  loadingFav = false;

  // --- Helperi
  private isBrowser = false;
  private posters: Record<string, string> = {}; // normalizovan_naslov => poster URL

  constructor(
    private router: Router,
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.loadUserData();
    this.loadReservations();
    this.loadFavorites(); // pokupi omiljene i pripremi kartice
  }

  // ====================== USER ======================
  private loadUserData(): void {
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        this.username = u?.username || '';
        this.email = u?.email || '';
      }
    } catch {}
  }

  updateProfile(): void {
    const body: any = {};
    if (this.newUsername?.trim()) body.username = this.newUsername.trim();
    if (this.newPassword?.trim()) body.password = this.newPassword.trim();

    if (!body.username && !body.password) {
      alert('Nema promena.');
      return;
    }

    this.filmoviService.updateUser(body).subscribe({
      next: (resp: any) => {
        this.username = resp?.user?.username ?? this.username;

        if (resp?.token && this.isBrowser) {
          localStorage.setItem('token', resp.token);
          const userRaw = localStorage.getItem('user');
          if (userRaw) {
            const u = JSON.parse(userRaw);
            u.username = this.username;
            localStorage.setItem('user', JSON.stringify(u));
          }
        }

        this.newUsername = '';
        this.newPassword = '';
        alert('Podaci uspešno ažurirani.');
      },
      error: (err) => alert(err?.error?.message || 'Greška pri ažuriranju.'),
    });
  }

  // ================== REZERVACIJE ==================
  private normalizeReservation(r: any): ReservationVM {
    let seatsCount = 0;
    try {
      const arr = JSON.parse(r.seats_json || '[]');
      seatsCount = Array.isArray(arr) ? arr.length : 0;
    } catch {}
    return {
      ...r,
      seats_count: seatsCount,
      total: r.total_eur ?? r.total ?? 0,
    };
  }

  loadReservations(): void {
    this.filmoviService.getMyReservations().subscribe({
      next: (rows) => {
        this.reservations = (rows || []).map((r) => this.normalizeReservation(r));
      },
      error: () => (this.reservations = []),
    });
  }

  removeReservation(id: number): void {
    if (!confirm('Da li ste sigurni da želite da uklonite rezervaciju?')) return;
    this.filmoviService.deleteReservation(id).subscribe({
      next: () => {
        this.reservations = this.reservations.filter((r) => r.id !== id);
      },
      error: (err) => alert(err?.error?.message || 'Greška pri brisanju.'),
    });
  }

  // =================== OMILJENI ====================
  loadFavorites(): void {
    this.loadingFav = true;
    this.filmoviService.getFavorites().subscribe({
      next: (rows: any) => {
        this.favorites = Array.isArray(rows) ? rows : [];
        this.loadingFav = false;
        this.refreshFavoriteCards();     // popuni favCards + dovuci postere
      },
      error: () => {
        this.favorites = [];
        this.favCards = [];
        this.loadingFav = false;
      },
    });
  }

  /** Prvo prikaže placeholder-e, zatim popuni postere pa ponovo izgradi kartice. */
  private refreshFavoriteCards(): void {
    this.buildFavCards();           // odmah prikaži sa placeholder-ima
    this.loadPostersForFavorites(); // kad posteri stignu, opet izgradi
  }

  private buildFavCards(): void {
    const ph = 'assets/images/poster-placeholder.png';
    this.favCards = (this.favorites || []).map((f) => {
      const title = f.film_title;
      const key = this.normTitle(title);
      const poster = this.posters[key] || ph;
      return { title, poster };
    });
  }

  /** Dovlači URL-ove postera i u mapu `posters` ih kešira. */
  private loadPostersForFavorites(): void {
    const favTitles = (this.favorites || []).map((f) => f.film_title).filter(Boolean);
    if (!favTitles.length) return;

    const wanted = new Set(favTitles.map((t) => this.normTitle(t)));

    // 1) lokalni filmovi
    this.filmoviService.getFilms().subscribe({
      next: (locals) => {
        for (const lf of locals || []) {
          const k = this.normTitle(lf.title);
          if (wanted.has(k) && lf.poster_url) this.posters[k] = lf.poster_url;
        }

        // 2) spoljni API
        this.filmoviService.getFilmovi().subscribe({
          next: (ext) => {
            for (const em of ext || []) {
              const k = this.normTitle(em.title);
              if (wanted.has(k) && !this.posters[k] && em.poster) {
                this.posters[k] = em.poster;
              }
            }
            // kada imamo što više postera osvezi kartice
            this.buildFavCards();
          },
          error: () => this.buildFavCards(),
        });
      },
      error: () => this.buildFavCards(),
    });
  }

  // ===================== Ostalo ====================
  goReserveByTitle(title: string): void {
    this.router.navigate(['/rezervacija', title]);
  }

  setTab(tab: 'reservations' | 'favorites') {
    this.activeTab = tab;
    if (tab === 'favorites' && !this.favorites.length) this.loadFavorites();
  }

  private normTitle(t: string): string {
    return String(t || '')
      .trim()
      .toLowerCase()
      .replace(/["'’‘“”\-.,:;(){}\[\]!?\s]/g, '')
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z')
      .replace(/đ/g, 'dj');
  }

  onPosterError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    img.onerror = null; // spreči loop
    img.src = 'assets/images/poster-placeholder.png';
  }
}
