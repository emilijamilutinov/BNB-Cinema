import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FilmoviService } from './filmovi.service';

@Component({
  selector: 'app-filmovi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './filmovi.component.html',
  styleUrls: ['./filmovi.component.css'],
})
export class FilmoviComponent {
  filmovi: any[] = [];
  filteredFilmovi: any[] = [];

  searchTitle = '';
  searchDirector = '';
  searchYear = '';
  searchGenre = '';

  hoveredFilm: any = null;

  selectedFilm: any = null;
  selectedRating = 5;
  selectedComment = '';
  filmReviews: { username: string; rating: number; comment: string }[] = [];
  averageRating = 0;

  isLoggedIn = false;
  username = '';
  isOwner = false;                   // <— owner guard za UI

  importQuery = '';  // <- novo polje

  // Admin alatka za import iz eksternog API-ja
  externalIdToImport = '';

  rezervisaniFilmovi: any[] = [];
  korpa: any[] = [];

  private isBrowser = false;

  constructor(
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // status korisnika
    this.updateUserStatus();

    // 1) Čitaj lokalne filmove iz baze (BE: /api/films)
    this.filmoviService.getLocalFilms().subscribe({
      next: (rows) => {
        this.filmovi = rows || [];
        this.filteredFilmovi = this.filmovi;
      },
      error: (err) => {
        console.error('Greška pri učitavanju lokalnih filmova:', err);
        // 2) Fallback – ako backend lista još nije spremna, povuci spoljne (opciono)
        this.loadExternalAsFallback();
      },
    });

    this.loadRezervisaniFilmovi();
    this.ucitajKorpu();
  }

  // ======== Fallback na spoljni API (ako želiš) ========
  private loadExternalAsFallback(): void {
    this.filmoviService.getExternalMovies().subscribe({
      next: (data) => {
        this.filmovi = data || [];
        this.filteredFilmovi = this.filmovi;
      },
      error: (err) => console.error('Greška pri učitavanju filmova sa spoljnog API-ja:', err),
    });
  }

  // ======== AUTH/ROLE ========
  private getUsernameFromToken(): string {
    if (!this.isBrowser) return '';
    const token = localStorage.getItem('token');
    if (!token || token.split('.').length < 2) return '';
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.username || payload.email || '';
    } catch {
      return '';
    }
  }

  private getRoleFromToken(): string {
    if (!this.isBrowser) return '';
    const t = localStorage.getItem('token');
    if (!t || t.split('.').length < 2) return '';
    try {
      const payload = JSON.parse(atob(t.split('.')[1]));
      return payload.role || '';
    } catch {
      return '';
    }
  }

  updateUserStatus(): void {
    if (!this.isBrowser) return;
    this.isLoggedIn = !!localStorage.getItem('token');
    this.username = this.isLoggedIn ? this.getUsernameFromToken() : '';
    this.isOwner = this.getRoleFromToken() === 'owner';
  }

  get isAuthenticated(): boolean {
    return this.isBrowser && !!localStorage.getItem('token');
  }

  // ======== MAPE POLJA (rade i za lokalne i za spoljne filmove) ========
  getTitle(f: any): string {
    return f?.title || f?.name || '';
  }

  getPoster(f: any): string {
    // lokalna baza -> poster_url; spoljni API -> poster
    return f?.poster_url || f?.poster || '';
  }

  getDirector(f: any): string {
    // lokalna baza: director (string)
    // spoljni API: director.name ili director (string)
    return f?.director?.name || f?.director || '';
  }

  getYear(f: any): string {
    // lokalna baza: release_date (YYYY-MM-DD)
    // spoljni API: startDate ili neko drugo polje datuma
    const d = f?.release_date || f?.startDate || '';
    return ('' + d).slice(0, 10);
  }

  getGenres(f: any): string {
    // lokalna baza: genre je CSV string
    if (typeof f?.genre === 'string' && f.genre.trim()) return f.genre;
    // spoljni API: movieGenres -> array of { genre: { name } }
    if (Array.isArray(f?.movieGenres)) {
      return f.movieGenres
        .map((g: any) => g?.genre?.name)
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }

  getDescription(f: any): string {
    return f?.description || f?.shortDescription || f?.overview || '';
  }

  // ======== UI: filtriranje ========
  filterMovies(): void {
    const year = this.searchYear ? new Date(this.searchYear).getFullYear().toString() : '';
    const genreQ = this.searchGenre.trim().toLowerCase();

    this.filteredFilmovi = this.filmovi.filter((f: any) => {
      const titleOk = this.getTitle(f).toLowerCase().includes(this.searchTitle.toLowerCase());
      const dirOk = (this.getDirector(f) || '').toLowerCase().includes(this.searchDirector.toLowerCase());
      const yr = this.getYear(f);
      const yearOk = year ? ('' + yr).includes(year) : true;
      const genres = this.getGenres(f).toLowerCase();
      const genreOk = genreQ ? genres.includes(genreQ) : true;
      return titleOk && dirOk && yearOk && genreOk;
    });
  }

  // ======== Detalji i recenzije ========
  openFilmDetails(film: any): void {
    this.selectedFilm = film;
    const mid = this.getMovieId(film) ?? this.makeIdFromTitle(this.getTitle(film));
    this.loadReviews(mid);
    if (this.isBrowser) {
      document.body.classList.add('no-scroll');
      document.documentElement.classList.add('no-scroll');
    }
  }

  closeModal(): void {
    this.selectedFilm = null;
    this.selectedRating = 5;
    this.selectedComment = '';
    if (this.isBrowser) {
      document.body.classList.remove('no-scroll');
      document.documentElement.classList.remove('no-scroll');
    }
  }

  loadReviews(movieId: number): void {
    this.filmoviService.getReviews(movieId).subscribe({
      next: (reviews) => {
        this.filmReviews = reviews || [];
        this.calculateAverageRating();
      },
      error: (err) => console.error('Greška pri učitavanju recenzija:', err),
    });

    this.filmoviService.getAvgRating(movieId).subscribe({
      next: (x) => { this.averageRating = typeof x?.avg === 'number' ? x.avg : 0; },
      error: () => { this.averageRating = 0; }
    });
  }

  submitReview(): void {
    if (!this.isLoggedIn || !this.selectedFilm) return;
    if (!this.selectedRating || !this.selectedComment.trim()) {
      alert('Unesite i ocenu i komentar.');
      return;
    }

    const filmId = this.getMovieId(this.selectedFilm) ?? this.makeIdFromTitle(this.getTitle(this.selectedFilm));

    const body = {
      filmId,
      filmTitle: this.getTitle(this.selectedFilm), // backend proverava po naslovu
      rating: this.selectedRating,
      comment: this.selectedComment.trim(),
    };

    this.filmoviService.submitReview(body).subscribe({
      next: () => {
        this.selectedComment = '';
        this.selectedRating = 5;
        this.loadReviews(filmId);
      },
      error: (err) => console.error('Greška pri slanju recenzije:', err),
    });
  }

  calculateAverageRating(): void {
    if (!this.filmReviews?.length) { this.averageRating = 0; return; }
    const total = this.filmReviews.reduce((s, r) => s + Number(r?.rating || 0), 0);
    this.averageRating = total / this.filmReviews.length;
  }

  // ======== Rezervacije (tvoji postojeći localStorage delovi) ========
  loadRezervisaniFilmovi(): void {
    if (!this.isBrowser) return;
    this.rezervisaniFilmovi = JSON.parse(localStorage.getItem('rezervisaniFilmovi') || '[]');
  }

  otkaziRezervaciju(filmTitle: string): void {
    if (!this.isBrowser) return;
    const list = JSON.parse(localStorage.getItem('rezervisaniFilmovi') || '[]')
      .filter((x: any) => x?.title !== filmTitle);
    localStorage.setItem('rezervisaniFilmovi', JSON.stringify(list));
    this.loadRezervisaniFilmovi();
  }

  dodajUKorpu(film: any): void {
    if (!this.isBrowser) return;
    if (!this.isLoggedIn) {
      alert('Prijavite se da biste dodali u korpu.');
      return;
    }
    const korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
    if (korpa.some((i: any) => i?.title === this.getTitle(film))) {
      alert('Ovaj film je već u korpi.');
      return;
    }
    korpa.push({ title: this.getTitle(film) });
    localStorage.setItem('korpa', JSON.stringify(korpa));
    this.ucitajKorpu();
  }

  ucitajKorpu(): void {
    if (!this.isBrowser) return;
    this.korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
  }

  // ======== OWNER akcije (import/CRUD preko BE) ========
  importExternal(): void {
  const q = (this.importQuery || '').trim();
  if (!q) { alert('Unesi naslov za import.'); return; }

  this.filmoviService.importByQuery(q).subscribe({
    next: () => {
      alert('Film importovan ✅');
      this.importQuery = '';
      this.loadFromDb();      // ponovo učitaj listu iz baze
    },
    error: (err) => {
      const msg = err?.error?.message || 'Greška pri importu';
      alert(msg);
      console.error('IMPORT error:', err);
    }
  });
}

  addFilm(): void {
    const title = prompt('Naslov filma:');
    if (!title) return;
    this.filmoviService.createFilm({ title, active: 1 }).subscribe({
      next: () => this.refreshLocalFilms(),
      error: () => alert('Greška pri kreiranju filma'),
    });
  }

  editFilm(film: any) {
  // TODO: otvori modal i pozovi filmoviService.updateFilm(id, body)
  console.log('edit', film);
}

deleteFilm(film: any) {
  if (!confirm(`Obrisati "${this.getTitle(film)}"?`)) return;
  this.filmoviService.deleteFilm(film.id).subscribe({
    next: () => this.loadFromDb(),
    error: (e) => alert(e?.error?.message || 'Greška pri brisanju')
  });
}
// === Ubaci u FilmoviComponent ===

// poziva se posle importa/brisanja/izmene da ponovo učita listu
loadFromDb(): void {
  // 1) pokušaj iz lokalne baze
  this.filmoviService.getFilms().subscribe({
    next: (rows) => {
      this.filmovi = rows || [];
      this.filteredFilmovi = [...this.filmovi];
      this.filterMovies(); // zadrži aktivne filtere
    },
    error: (e) => {
      console.warn('Nema lokalnih filmova ili greška, pada fallback na eksterni API.', e);
      // 2) fallback na spoljni API da UI ne ostane prazan
      this.filmoviService.getExternalMovies().subscribe({
        next: (ext) => {
          this.filmovi = ext || [];
          this.filteredFilmovi = [...this.filmovi];
          this.filterMovies();
        },
        error: (err2) => {
          console.error('Greška i na spoljnjem API-ju:', err2);
          this.filmovi = [];
          this.filteredFilmovi = [];
        }
      });
    }
  });
}

// zgodan alias ako negde već koristiš staro ime
refreshLocalFilms(): void {
  this.loadFromDb();
}



  /*private refreshLocalFilms(): void {
    this.filmoviService.getLocalFilms().subscribe({
      next: (rows) => { this.filmovi = rows || []; this.filteredFilmovi = this.filmovi; },
      error: (e) => console.error(e),
    });
  }*/

  // ======== ID helperi ========
  private getMovieId(film: any): number | undefined {
    // lokalna baza nema tmdbId — koristi id (lokalni) ili hash naslova kao fallback
    return film?.movieId ?? film?.id;
  }

  private makeIdFromTitle(title: string): number {
    const norm = (title || '')
      .toLowerCase()
      .replace(/["'’‘“”\-\.\,\:\;\(\)\[\]\{\}\s]/g, '')
      .replace(/č/g,'c').replace(/ć/g,'c').replace(/š/g,'s').replace(/ž/g,'z').replace(/đ/g,'dj');
    // jednostavan deterministički hash (djb2)
    let h = 5381;
    for (let i = 0; i < norm.length; i++) h = ((h << 5) + h) + norm.charCodeAt(i);
    return Math.abs(h);
  }
}
