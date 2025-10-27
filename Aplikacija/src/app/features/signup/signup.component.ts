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
      username: ['', [Validators.required, Validators.minLength(3)]], 
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
  console.log('Signup submit klik'); // da vidiš da je klik stigao

  if (this.signupForm.invalid) {
    console.log('Forma nevažeća', this.signupForm.value);
    return;
  }

  const { username, email, password } = this.signupForm.value;
  console.log('Šaljem payload:', { username, email, password });

  this.authService.signup({ username, email, password }).subscribe({
    next: (res) => {
      console.log('Signup OK:', res);
      this.router.navigate(['/login']);
    },
    error: (err) => {
      console.error('Signup error:', err);
      this.errorMessage = err?.error?.message || 'Greška pri registraciji. Pokušajte ponovo.';
    }
  });
}

}
