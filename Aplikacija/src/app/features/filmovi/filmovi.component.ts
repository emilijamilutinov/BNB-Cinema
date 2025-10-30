import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FilmoviService } from './filmovi.service';
import { RouterModule } from '@angular/router';

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
    this.filmoviService.getFilmovi().subscribe({
      next: (data) => {
        this.filmovi = data;
        this.filteredFilmovi = data;
      },
      error: (err) => console.error('Greška pri učitavanju filmova:', err),
    });

    this.updateUserStatus();
    this.loadRezervisaniFilmovi();
    this.ucitajKorpu();
  }

  // UI helpers
  getGenresAsString(film: any): string {
    if (!film?.movieGenres) return '';
    return film.movieGenres.map((g: any) => g.genre?.name).filter(Boolean).join(', ');
  }

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

  updateUserStatus(): void {
    if (!this.isBrowser) return;
    this.isLoggedIn = !!localStorage.getItem('token');
    this.username = this.isLoggedIn ? this.getUsernameFromToken() : '';
  }

  openFilmDetails(film: any): void {
  this.selectedFilm = film;
  const mid = this.getMovieId(film) ?? this.makeIdFromTitle(film.title);
  this.loadReviews(mid);
  if (this.isBrowser) { document.body.classList.add('no-scroll'); document.documentElement.classList.add('no-scroll'); }
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
  if (!this.selectedRating || !this.selectedComment.trim()) { alert('Unesite i ocenu i komentar.'); return; }

  const filmId = this.getMovieId(this.selectedFilm) ?? this.makeIdFromTitle(this.selectedFilm.title);

  const body = {
    filmId,
    filmTitle: this.selectedFilm.title, // VAŽNO: backend proverava po naslovu
    rating: this.selectedRating,
    comment: this.selectedComment.trim(),
  };

  this.filmoviService.submitReview(body).subscribe({
    next: () => {
      this.selectedComment = '';
      this.selectedRating = 5;
      this.loadReviews(filmId);             // ← ovde prosleđujemo ID (broj), ne funkciju
    },
    error: (err) => console.error('Greška pri slanju recenzije:', err),
  });
}

calculateAverageRating(): void {
  if (!this.filmReviews?.length) { this.averageRating = 0; return; }
  const total = this.filmReviews.reduce((s, r) => s + Number(r?.rating || 0), 0);
  this.averageRating = total / this.filmReviews.length;
}



  // Filters
  filterMovies(): void {
    const year = this.searchYear ? new Date(this.searchYear).getFullYear().toString() : '';
    const genreQ = this.searchGenre.trim().toLowerCase();

    this.filteredFilmovi = this.filmovi.filter((f: any) => {
      const titleOk = (f.title || '').toLowerCase().includes(this.searchTitle.toLowerCase());
      const dirOk = (f.director?.name || '').toLowerCase().includes(this.searchDirector.toLowerCase());
      const yearOk = year ? ('' + f.startDate).includes(year) : true;
      const genreOk = genreQ
        ? (f.movieGenres || []).some((g: any) => (g.genre?.name || '').toLowerCase().includes(genreQ))
        : true;
      return titleOk && dirOk && yearOk && genreOk;
    });
  }

  // Local storage helpers
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

  get isAuthenticated(): boolean {
    return this.isBrowser && !!localStorage.getItem('token');
  }

  dodajUKorpu(film: any): void {
    if (!this.isBrowser) return;

    if (!this.isLoggedIn) {
      alert('Prijavite se da biste dodali u korpu.');
      return;
    }

    const korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
    if (korpa.some((i: any) => i?.title === film?.title)) {
      alert('Ovaj film je već u korpi.');
      return;
    }
    korpa.push(film);
    localStorage.setItem('korpa', JSON.stringify(korpa));
    this.ucitajKorpu();
  }

  ucitajKorpu(): void {
    if (!this.isBrowser) return;
    this.korpa = JSON.parse(localStorage.getItem('korpa') || '[]');
  }
  

private getMovieId(film: any): number | undefined {
  return film?.movieId ?? film?.id; // šta god tvoj API pošalje
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
