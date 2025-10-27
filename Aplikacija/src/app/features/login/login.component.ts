import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule, NgIf, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, NgIf, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  loading = false;
  isBrowser: boolean;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.loading) return;

    this.errorMessage = '';
    this.loading = true;

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        if (this.isBrowser) localStorage.setItem('token', res.token);
        this.router.navigate(['/filmovi']);
      },
      error: (err) => {
        console.error('Login greška:', err);
        this.errorMessage = err?.error?.message || 'Neispravan email ili lozinka.';
        this.loading = false;
      }
    });
  }
}
