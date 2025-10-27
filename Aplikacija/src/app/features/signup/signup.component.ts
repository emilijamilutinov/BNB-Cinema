import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  imports: [NgIf, ReactiveFormsModule]
})
export class SignupComponent {
  signupForm: FormGroup;
  errorMessage = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      username: ['', [Validators.required]], 
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
  if (this.signupForm.invalid) return;

  const { username, email, password } = this.signupForm.value; // <-- username
  this.authService.signup({ username, email, password }).subscribe({
    next: () => this.router.navigate(['/login']),
    error: (err) => {
      // lepši prikaz greški
      const msg = err?.error?.message || 'Greška pri registraciji. Pokušajte ponovo.';
      this.errorMessage = msg;
      console.error('Signup error:', err);
    }
  });
}

}
