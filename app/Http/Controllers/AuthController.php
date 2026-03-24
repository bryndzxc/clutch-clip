<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AuthController extends Controller
{
    public function showLogin(): InertiaResponse
    {
        return Inertia::render('Login');
    }

    public function login(Request $request): RedirectResponse
    {
        return redirect()
            ->route('login')
            ->withErrors(['auth' => 'Email/password sign-in is disabled. Continue with Google to access ClutchClip.']);
    }

    public function showRegister(): InertiaResponse
    {
        return Inertia::render('Register');
    }

    public function register(Request $request): RedirectResponse
    {
        return redirect()
            ->route('register')
            ->withErrors(['auth' => 'Email/password sign-up is disabled. Continue with Google to create your account.']);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
