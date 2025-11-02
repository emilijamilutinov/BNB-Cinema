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
  isOwner = false;

  // Admin alatke
  externalIdToImport = ''; // koristimo ga kao ‘query’ (naziv filma)

  rezervisaniFilmovi: any[] = [];
  korpa: any[] = [];

  private isBrowser = false;

  // Owner editor (termini)
  editingOpen = false;
  editingFilm: any = null;
  editingLocalId: number | null = null;
  screenings: any[] = [];

  newScreening = {
    date: '',
    time: '',
    hall: 'Sala 1',
    base_price_std: 4.0,
    base_price_vip: 6.0,
    is_active: true,
  };

  constructor(
    private filmoviService: FilmoviService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.updateUserStatus();

    // 1) Probaj lokalne filmove
    this.filmoviService.getLocalFilms().subscribe({
      next: (rows) => {
        this.filmovi = rows || [];
        this.filteredFilmovi = this.filmovi;
      },
      error: () => {
        // 2) fallback – spoljni API
        this.loadExternalAsFallback();
      },
    });

    this.loadRezervisaniFilmovi();
    this.ucitajKorpu();
    this.isOwner = this.getRoleFromToken() === 'owner';
  }

  // ========== Fallback spoljni API ==========
  private loadExternalAsFallback(): void {
    this.filmoviService.getExternalMovies().subscribe({
      next: (data) => {
        this.filmovi = data || [];
        this.filteredFilmovi = this.filmovi;
      },
      error: (err) =>
        console.error('Greška pri učitavanju filmova sa spoljnog API-ja:', err),
    });
  }

  // ========== AUTH/ROLE ==========
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

  private getRoleFromToken(): string | null {
    if (!this.isBrowser) return null;
    const token = localStorage.getItem('token');
    if (!token || token.split('.').length < 2) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    } catch {
      return null;
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

  // ========== MAPE POLJA ==========
  getPoster(f: any) {
    return f?.poster || f?.poster_url || '';
  }
  getTitle(f: any) {
    return f?.title || f?.name || '';
  }
  getDirector(f: any) {
    return f?.director?.name || f?.director || '';
  }
  getYear(f: any) {
    return (f?.startDate || f?.release_date || '').toString().slice(0, 4);
  }
  getGenres(f: any) {
    if (Array.isArray(f?.movieGenres)) {
      return f.movieGenres
        .map((g: any) => g?.genre?.name)
        .filter(Boolean)
        .join(', ');
    }
    if (Array.isArray(f?.genres)) return f.genres.join(', ');
    return f?.genre || '';
  }
  getDescription(f: any) {
    return f?.shortDescription || f?.description || f?.overview || '';
  }

  // ========== Filter ==========
  filterMovies(): void {
    const year = this.searchYear
      ? new Date(this.searchYear).getFullYear().toString()
      : '';
    const genreQ = this.searchGenre.trim().toLowerCase();

    this.filteredFilmovi = this.filmovi.filter((f: any) => {
      const titleOk = this.getTitle(f)
        .toLowerCase()
        .includes(this.searchTitle.toLowerCase());
      const dirOk = (this.getDirector(f) || '')
        .toLowerCase()
        .includes(this.searchDirector.toLowerCase());
      const yr = this.getYear(f);
      const yearOk = year ? ('' + yr).includes(year) : true;
      const genres = this.getGenres(f).toLowerCase();
      const genreOk = genreQ ? genres.includes(genreQ) : true;
      return titleOk && dirOk && yearOk && genreOk;
    });
  }

  // ========== Detalji i recenzije ==========
  openFilmDetails(film: any): void {
    this.selectedFilm = film;
    const mid =
      this.getMovieId(film) ?? this.makeIdFromTitle(this.getTitle(film));
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
      error: (err) =>
        console.error('Greška pri učitavanju recenzija:', err),
    });

    this.filmoviService.getAvgRating(movieId).subscribe({
      next: (x) => {
        this.averageRating = typeof x?.avg === 'number' ? x.avg : 0;
      },
      error: () => {
        this.averageRating = 0;
      },
    });
  }

  submitReview(): void {
    if (!this.isLoggedIn || !this.selectedFilm) return;
    if (!this.selectedRating || !this.selectedComment.trim()) {
      alert('Unesite i ocenu i komentar.');
      return;
    }

    const filmId =
      this.getMovieId(this.selectedFilm) ??
      this.makeIdFromTitle(this.getTitle(this.selectedFilm));

    const body = {
      filmId,
      filmTitle: this.getTitle(this.selectedFilm),
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
    if (!this.filmReviews?.length) {
      this.averageRating = 0;
      return;
    }
    const total = this.filmReviews.reduce(
      (s, r) => s + Number(r?.rating || 0),
      0
    );
    this.averageRating = total / this.filmReviews.length;
  }

  // ========== Rezervacije (localStorage delovi) ==========
  loadRezervisaniFilmovi(): void {
    if (!this.isBrowser) return;
    this.rezervisaniFilmovi = JSON.parse(
      localStorage.getItem('rezervisaniFilmovi') || '[]'
    );
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

  // ========== OWNER: Import i CRUD ==========
  importExternal(): void {
  const query = (this.importQuery || '').trim();
  if (!query) { alert('Unesi naziv filma za import.'); return; }
  this.filmoviService.importByQuery(query).subscribe({
    next: () => { alert('Importovano.'); this.loadFromDb(); },
    error: (err) => alert(err?.error?.message || 'Greška pri importu filma.')
  });
}



  addFilm(): void {
    const title = prompt('Naslov novog filma:');
    if (!title) return;
    this.filmoviService.createFilm({ title, active: 1 }).subscribe({
      next: () => {
        alert('Film kreiran u lokalnoj bazi.');
        this.loadFromDb();
      },
      error: (err) =>
        alert(err?.error?.message || 'Greška pri kreiranju filma.'),
    });
  }

  // ========== OWNER: Editor termina ==========
  editFilm(film: any): void {
    this.editingFilm = film;
    this.editingLocalId = null;
    this.screenings = [];
    this.editingOpen = true;

    this.filmoviService.getLocalFilms().subscribe({
      next: (locals) => {
        const title = (this.getTitle(film) || '').trim().toLowerCase();
        const found = (locals || []).find(
          (x: any) => (x?.title || '').trim().toLowerCase() === title
        );
        if (!found) {
          alert(
            'Ovaj film još nije uvezen u lokalnu bazu. Klikni "Importuj iz API-ja" pa probaj ponovo.'
          );
          return;
        }
        this.editingLocalId = found.id;
        this.loadScreenings();
      },
      error: () => alert('Greška pri učitavanju lokalnih filmova.'),
    });
  }

  closeEditor(): void {
    this.editingOpen = false;
    this.editingFilm = null;
    this.editingLocalId = null;
    this.screenings = [];
    this.newScreening = {
      date: '',
      time: '',
      hall: 'Sala 1',
      base_price_std: 4.0,
      base_price_vip: 6.0,
      is_active: true,
    };
  }

  loadScreenings(): void {
    if (!this.editingLocalId) return;
    this.filmoviService.getScreenings(this.editingLocalId).subscribe({
      next: (rows) => (this.screenings = rows || []),
      error: () => (this.screenings = []),
    });
  }

  saveScreening(): void {
    if (!this.editingLocalId) return;
    if (!this.newScreening.date || !this.newScreening.time) {
      alert('Unesi datum i vreme.');
      return;
    }
    const starts_at = `${this.newScreening.date} ${this.newScreening.time}:00`;
    this.filmoviService
      .createScreening(this.editingLocalId, {
        starts_at,
        hall: this.newScreening.hall || 'Sala 1',
        base_price_std: Number(this.newScreening.base_price_std) || 4.0,
        base_price_vip: Number(this.newScreening.base_price_vip) || 6.0,
        is_active: this.newScreening.is_active ? 1 : 0,
      })
      .subscribe({
        next: () => {
          this.newScreening.time = '';
          this.loadScreenings();
        },
        error: (err) =>
          alert(err?.error?.message || 'Greška pri čuvanju termina.'),
      });
  }

  removeScreening(id: number): void {
    if (!confirm('Obriši ovaj termin?')) return;
    this.filmoviService.deleteScreening(id).subscribe({
      next: () => this.loadScreenings(),
      error: () => alert('Greška pri brisanju termina.'),
    });
  }
  // === OWNER: brisanje filma iz lokalne baze (dugme "Obriši") ===
deleteFilm(film: any): void {
  if (!this.isOwner) { alert('Samo vlasnik može da briše filmove.'); return; }

  const title = (this.getTitle(film) || '').trim().toLowerCase();
  if (!title) { alert('Nepoznat naslov.'); return; }

  if (!confirm(`Obriši film "${this.getTitle(film)}" iz lokalne baze?`)) return;

  // Najpre pronađi lokalni zapis kako bismo imali ID
  this.filmoviService.getLocalFilms().subscribe({
    next: (locals) => {
      const found = (locals || []).find((x: any) =>
        (x?.title || '').trim().toLowerCase() === title
      );
      if (!found) {
        alert('Ovaj film nije u lokalnoj bazi (uvezi ga pre brisanja).');
        return;
      }

      this.filmoviService.deleteFilm(found.id).subscribe({
        next: () => {
          alert('Film obrisan.');
          this.loadFromDb(); // osveži listu
        },
        error: (err) => alert(err?.error?.message || 'Greška pri brisanju filma.')
      });
    },
    error: () => alert('Greška pri čitanju lokalnih filmova.')
  });
}
// field for the input bound with [(ngModel)]="importQuery"
importQuery: string = '';

// called by (click)="importExternal()"




  // Pozovi posle importa/brisanja/izmene da refrešuje listu
  loadFromDb(): void {
    this.filmoviService.getLocalFilms().subscribe({
      next: (rows) => {
        this.filmovi = rows || [];
        this.filteredFilmovi = [...this.filmovi];
        this.filterMovies();
      },
      error: (e) => {
        console.warn(
          'Nema lokalnih filmova ili greška, pada fallback na eksterni API.',
          e
        );
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
          },
        });
      },
    });
  }

  // ========== ID helperi ==========
  private getMovieId(film: any): number | undefined {
    return film?.movieId ?? film?.id;
  }

  private makeIdFromTitle(title: string): number {
    const norm = (title || '')
      .toLowerCase()
      .replace(/["'’‘“”\-\.\,\:\;\(\)\[\]\{\}\s]/g, '')
      .replace(/č/g, 'c')
      .replace(/ć/g, 'c')
      .replace(/š/g, 's')
      .replace(/ž/g, 'z')
      .replace(/đ/g, 'dj');
    let h = 5381;
    for (let i = 0; i < norm.length; i++) h = (h << 5) + h + norm.charCodeAt(i);
    return Math.abs(h);
  }
  
}
