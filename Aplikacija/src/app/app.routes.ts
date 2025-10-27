import { Routes } from '@angular/router';
import { AboutComponent } from './features/about/about.component';
import { HomeComponent } from './features/home/home.component';
import { LoginComponent } from './features/login/login.component';
import { SignupComponent } from './features/signup/signup.component';
import { FilmoviComponent } from './features/filmovi/filmovi.component';
import { RezervacijaComponent } from './features/rezervacija/rezervacija.component';
import { ProfileComponent } from './features/profile/profile.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
    { path: 'login', component: LoginComponent },
    { path: 'signup', component: SignupComponent },
    { path: 'about', component: AboutComponent }, 
    { path: 'filmovi', component: FilmoviComponent },
    { path: 'rezervacija/:title', component: RezervacijaComponent },  
   { path: 'profile', component: ProfileComponent }, 
    { path: '**', redirectTo: '', pathMatch: 'full' } 
];
