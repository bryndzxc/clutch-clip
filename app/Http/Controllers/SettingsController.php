<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class SettingsController extends Controller
{
    public function show(): InertiaResponse
    {
        /** @var User $user */
        $user = auth()->user();

        return Inertia::render('Settings', [
            'settings' => $user->getSettings(),
            'account'  => [
                'name'             => $user->name,
                'email'            => $user->email,
                'avatar'           => $user->avatar,
                'google_connected' => (bool) $user->google_id,
                'has_password'     => (bool) $user->password,
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'clip_count'        => ['required', 'integer', 'in:3,5'],
            'pre_roll'          => ['required', 'integer', 'min:0', 'max:15'],
            'post_roll'         => ['required', 'integer', 'min:0', 'max:15'],
            'merge_gap'         => ['required', 'integer', 'min:0', 'max:60'],
            'min_score'         => ['required', 'integer', 'min:0', 'max:100'],
            'output_quality'    => ['required', 'string', 'in:standard,high,smaller'],
            'resolution'        => ['required', 'string', 'in:720p,1080p'],
            'aspect_ratio'      => ['required', 'string', 'in:original,vertical'],
            'auto_delete_hours' => ['required', 'integer', 'in:24,48,168'],
            'name'              => ['required', 'string', 'max:255'],
        ]);

        /** @var User $user */
        $user = auth()->user();

        // Save display name separately
        $user->update(['name' => $validated['name']]);

        // Save all processing/output settings as JSON
        $settings = collect($validated)->except('name')->all();
        $user->update(['settings' => $settings]);

        return back()->with('success', 'Settings saved successfully.');
    }
}
