<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'appName' => config('app.name'),
            'flash'   => [
                'feedback_sent' => $request->session()->get('feedback_sent'),
            ],
            'auth'    => [
                'user' => $request->user() ? [
                    'id'       => $request->user()->id,
                    'name'     => $request->user()->name,
                    'email'    => $request->user()->email,
                    'avatar'   => $request->user()->avatar,
                    'is_admin' => $request->user()->isAdmin(),
                ] : null,
            ],
        ]);
    }
}
