import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

export interface RezervacijaPayload {
  film_title?: string | null;
  datum?: string | null;            // <— sada sme i null
  screening_id?: number | null;     // <— novo polje
  seats: { row: string; num: number }[];
  total?: number | null;
}

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

  
 postRezervacija(body: RezervacijaPayload): Observable<any> {
  return this.http.post(`${this.apiBase}/rezervacije`, body, {
    headers: this.authHeaders()
  });
}
/** Moje rezervacije (normalizuje hall, starts_date, starts_time) */
getMyReservations(): Observable<any[]> {
  return this.http.get<any[]>(`${this.apiBase}/rezervacije`, {
    headers: this.authHeaders()
  }).pipe(
    map(rows => (rows || []).map((r: any) => {
      // prioritet: već razdvojena polja sa backend-a
      let startsDate = r.starts_date || '';
      let startsTime = r.starts_time || '';
      let hall       = r.hall || '';

      // ako dobijamo samo starts_at: "YYYY-MM-DD HH:mm:ss"
      if ((!startsDate || !startsTime) && r.starts_at) {
        const iso = String(r.starts_at).replace(' ', 'T');   // "2025-11-03T20:00:00"
        // bez obzira na vremenske zone, za prikaz je dovoljno iseći string:
        startsDate = iso.slice(0, 10); // YYYY-MM-DD
        startsTime = iso.slice(11, 16); // HH:mm
      }

      // fallback na staro polje datum (ako nema screenings)
      if (!startsDate && r.datum) startsDate = r.datum;

      return {
        ...r,
        hall,
        starts_date: startsDate,
        starts_time: startsTime,
      };
    })),
    catchError(err => {
      console.error('Greška pri čitanju rezervacija:', err);
      return throwError(() => new Error('Greška pri čitanju rezervacija'));
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
  // === FAVORITES (po naslovu) ===
getFavorites() {
  return this.http.get<{ film_title: string }[]>(
    `${this.apiBase}/favorites`,
    { headers: this.authHeaders() }
  );
}

isFavoriteByTitle(title: string) {
  const params = new HttpParams().set('film_title', title);
  return this.http.get<{ isFavorite: boolean }>(
    `${this.apiBase}/favorites/is`,
    { headers: this.authHeaders(), params }
  );
}

toggleFavoriteByTitle(title: string) {
  return this.http.post<{ isFavorite: boolean }>(
    `${this.apiBase}/favorites/toggle`,
    { film_title: title },
    { headers: this.authHeaders() }
  );
}
// profil (PATCH /api/user)
updateUser(body: { username?: string; password?: string }) {
  return this.http.patch(`${this.apiBase}/user`, body, { headers: this.authHeaders() });
}



// delete reservation
deleteReservation(id: number) {
  return this.http.delete(`${this.apiBase}/rezervacije/${id}`, { headers: this.authHeaders() });
}

  
}
