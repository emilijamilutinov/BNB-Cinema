import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class FilmoviService {
  // Spoljni API (fallback / pretraga)
  private externalApiUrl =
    'https://movie.pequla.com/api/movie?director=&actor=&search=&genre=';

  // Moj backend (lokalna baza)
  private apiBase = 'http://localhost:4000/api';

  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ==========================
  // AUTH HEADER (JWT)
  // ==========================
  private authHeaders(): HttpHeaders {
    if (!this.isBrowser) return new HttpHeaders();
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  // ==========================
  // FILMOVI – LOKALNA BAZA
  // ==========================

  /** Lista filmova iz lokalne baze */
  getFilms(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/films`).pipe(
      catchError(err => {
        console.error('Greška pri učitavanju lokalnih filmova:', err);
        return throwError(() => new Error('Greška pri učitavanju lokalnih filmova'));
      })
    );
  }

  /** (alias ako negde koristiš ovo ime) */
  getLocalFilms(): Observable<any[]> {
    return this.getFilms();
  }

  /** Jedan film iz lokalne baze */
  getFilm(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiBase}/films/${id}`).pipe(
      catchError(err => {
        console.error('Greška pri učitavanju filma:', err);
        return throwError(() => new Error('Greška pri učitavanju filma'));
      })
    );
  }

  /** Kreiranje filma (samo owner) */
  createFilm(body: {
    title: string;
    description?: string | null;
    director?: string | null;
    release_date?: string | null;     // 'YYYY-MM-DD'
    genre?: string | null;            // npr. "Drama, Akcija"
    runtime_minutes?: number | null;
    poster_url?: string | null;
    backdrop_url?: string | null;
    active?: 0 | 1 | boolean;
  }): Observable<any> {
    return this.http.post(`${this.apiBase}/films`, body, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Film kreiran')),
      catchError(err => {
        console.error('Greška pri kreiranju filma:', err);
        const msg = err?.error?.message || 'Greška pri kreiranju filma';
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Izmena filma (samo owner) */
  updateFilm(id: number, body: Partial<{
    title: string;
    description: string | null;
    director: string | null;
    release_date: string | null;
    genre: string | null;
    runtime_minutes: number | null;
    poster_url: string | null;
    backdrop_url: string | null;
    active: 0 | 1 | boolean;
  }>): Observable<any> {
    return this.http.put(`${this.apiBase}/films/${id}`, body, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Film izmenjen')),
      catchError(err => {
        console.error('Greška pri izmeni filma:', err);
        const msg = err?.error?.message || 'Greška pri izmeni filma';
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Brisanje filma (samo owner) */
  deleteFilm(id: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/films/${id}`, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Film obrisan')),
      catchError(err => {
        console.error('Greška pri brisanju filma:', err);
        const msg = err?.error?.message || 'Greška pri brisanju filma';
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Import iz spoljnog API-ja po nazivu (samo owner).
   * Backend očekuje body { query: 'Naslov' }.
   */
  importByQuery(query: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/films/import`,
      { query }, // ključ MORA biti "query"
      { headers: this.authHeaders() }
    ).pipe(
      tap(() => console.log('Film importovan iz spoljnog API-ja')),
      catchError(err => {
        console.error('Greška pri importu filma:', err);
        const msg = err?.error?.message || 'Greška pri importu filma';
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Alias da komponenta može da zove importFromExternal(...) */
  importFromExternal(query: string): Observable<any> {
    return this.importByQuery(query);
  }

  // ==========================
  // SPOLJNI API (FALLBACK)
  // ==========================

  /** Lista filmova sa spoljnog API-ja (ako želiš pretragu/fallback) */
  getExternalMovies(): Observable<any[]> {
    return this.http.get<any[]>(this.externalApiUrl).pipe(
      catchError((err) => {
        console.error('Greška pri učitavanju filmova sa spoljnog API-ja:', err);
        return throwError(() => new Error('Greška pri učitavanju filmova'));
      })
    );
  }

  /** (legacy ime) – ostavljeno ako negde još koristiš ovo ime */
  getFilmovi(): Observable<any[]> {
    return this.getExternalMovies();
  }

  // ==========================
  // REZERVACIJE
  // ==========================

  /** Zauzeta sedišta za film i datum */
  getTakenSeats(film_title: string, datum: string): Observable<string[]> {
    const params = new HttpParams().set('film_title', film_title).set('datum', datum);
    return this.http.get<string[]>(`${this.apiBase}/taken-seats`, { params }).pipe(
      catchError(err => {
        console.error('Greška pri čitanju zauzetih sedišta:', err);
        return throwError(() => new Error('Greška pri čitanju zauzetih sedišta'));
      })
    );
  }

  /** Potvrda rezervacije (čuva u bazi; autorizovano) */
  postRezervacija(body: {
    film_title: string;
    datum: string;
    seats: { row: string; num: number }[];
    total: number; // ili 0 ako se računa na serveru
  }): Observable<any> {
    return this.http.post(`${this.apiBase}/rezervacije`, body, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Rezervacija sačuvana')),
      catchError(err => {
        console.error('Greška pri slanju rezervacije:', err);
        const msg = err?.error?.message || 'Greška pri slanju rezervacije';
        return throwError(() => new Error(msg));
      })
    );
  }

  // ==========================
  // SCREENINGS (termini projekcija)
  // ==========================
  getScreenings(filmId: number) {
    return this.http.get<any[]>(`${this.apiBase}/films/${filmId}/screenings`);
  }

  createScreening(
    filmId: number,
    body: {
      starts_at: string; // "YYYY-MM-DD HH:mm:ss"
      hall?: string;
      base_price_std?: number;
      base_price_vip?: number;
      is_active?: boolean | 0 | 1;
    }
  ) {
    return this.http.post(
      `${this.apiBase}/films/${filmId}/screenings`,
      body,
      { headers: this.authHeaders() }
    );
  }

  updateScreening(
    id: number,
    body: Partial<{
      starts_at: string;
      hall: string;
      base_price_std: number;
      base_price_vip: number;
      is_active: boolean | 0 | 1;
    }>
  ) {
    return this.http.put(
      `${this.apiBase}/screenings/${id}`,
      body,
      { headers: this.authHeaders() }
    );
  }

  deleteScreening(id: number) {
    return this.http.delete(
      `${this.apiBase}/screenings/${id}`,
      { headers: this.authHeaders() }
    );
  }

  getTakenSeatsByScreening(screeningId: number) {
    const params = new HttpParams().set('screening_id', screeningId);
    return this.http.get<string[]>(`${this.apiBase}/taken-seats`, { params });
  }

  // ==========================
  // RECENZIJE
  // ==========================

  /** Lista recenzija za film */
  getReviews(movieId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/reviews/${movieId}`).pipe(
      catchError((err) => {
        console.error('Greška pri učitavanju recenzija:', err);
        return throwError(() => new Error('Greška pri učitavanju recenzija'));
      })
    );
  }

  /** Prosek ocena za film */
  getAvgRating(movieId: number): Observable<{ avg: number | null }> {
    return this.http.get<{ avg: number | null }>(`${this.apiBase}/reviews/${movieId}/avg`).pipe(
      catchError(err => {
        console.error('Greška pri čitanju proseka ocena:', err);
        return throwError(() => new Error('Greška pri čitanju proseka ocena'));
      })
    );
  }

  /** Slanje recenzije (autorizovano) */
  submitReview(review: {
    filmId: number;
    filmTitle: string;
    rating: number;
    comment: string;
  }): Observable<any> {
    return this.http.post(`${this.apiBase}/reviews`, review, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Recenzija poslata')),
      catchError((err) => {
        const msg = err?.error?.message || 'Greška pri slanju recenzije';
        console.error('Greška pri slanju recenzije:', err);
        return throwError(() => new Error(msg));
      })
    );
  }

  /** Brisanje moje recenzije za film (autorizovano) */
  deleteMyReview(movieId: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/reviews/${movieId}`, {
      headers: this.authHeaders()
    }).pipe(
      tap(() => console.log('Recenzija obrisana')),
      catchError((err) => {
        console.error('Greška pri brisanju recenzije:', err);
        return throwError(() => new Error('Greška pri brisanju recenzije'));
      })
    );
  }
}
