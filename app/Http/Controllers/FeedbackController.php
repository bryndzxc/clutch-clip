<?php

namespace App\Http\Controllers;

use App\Models\FeedbackReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type'               => ['required', 'in:bug_report,feature_request,general'],
            'subject'            => ['required', 'string', 'max:200'],
            'message'            => ['required', 'string', 'max:3000'],
            'page'               => ['nullable', 'string', 'max:300'],
            'related_project_id' => ['nullable', 'integer'],
        ]);

        FeedbackReport::create([
            ...$data,
            'user_id' => auth()->id(),
        ]);

        return back()->with('feedback_sent', true);
    }
}
