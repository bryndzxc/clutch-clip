<?php

namespace App\Http\Controllers;

use App\Models\FeedbackReport;
use App\Models\Montage;
use App\Models\MontageProject;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class AdminController extends Controller
{
    public function dashboard(): InertiaResponse
    {
        $weekAgo = Carbon::now()->subWeek();

        $stats = [
            'total_users'    => User::count(),
            'new_users_week' => User::where('created_at', '>=', $weekAgo)->count(),
            'total_projects' => MontageProject::count(),
            'total_renders'  => Montage::where('status', 'completed')->count(),
            'failed_renders' => Montage::where('status', 'failed')->count(),
            'total_feedback' => FeedbackReport::count(),
            'new_feedback'   => FeedbackReport::where('status', 'new')->count(),
        ];

        $recentUsers = User::orderByDesc('created_at')
            ->limit(8)
            ->get(['id', 'name', 'email', 'created_at', 'is_admin'])
            ->map(fn ($u) => [
                'id'         => $u->id,
                'name'       => $u->name,
                'email'      => $u->email,
                'created_at' => $u->created_at->diffForHumans(),
                'is_admin'   => $u->is_admin,
            ]);

        $recentFeedback = FeedbackReport::with('user')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn ($f) => [
                'id'         => $f->id,
                'type'       => $f->type,
                'subject'    => $f->subject,
                'status'     => $f->status,
                'user_name'  => $f->user?->name ?? 'Guest',
                'created_at' => $f->created_at->diffForHumans(),
            ]);

        $recentRenders = Montage::with(['user', 'project'])
            ->orderByDesc('created_at')
            ->limit(6)
            ->get()
            ->map(fn ($m) => [
                'id'         => $m->id,
                'title'      => $m->title ?? "Montage #{$m->id}",
                'status'     => $m->status,
                'user_name'  => $m->user?->name ?? '—',
                'created_at' => $m->created_at->diffForHumans(),
            ]);

        return Inertia::render('Admin/Dashboard', [
            'stats'          => $stats,
            'recentUsers'    => $recentUsers,
            'recentFeedback' => $recentFeedback,
            'recentRenders'  => $recentRenders,
        ]);
    }

    public function users(Request $request): InertiaResponse
    {
        $users = User::withCount(['montageProjects', 'montages'])
            ->orderByDesc('created_at')
            ->paginate(20)
            ->through(fn ($u) => [
                'id'             => $u->id,
                'name'           => $u->name,
                'email'          => $u->email,
                'is_admin'       => $u->is_admin,
                'projects_count' => $u->montage_projects_count,
                'renders_count'  => $u->montages_count,
                'created_at'     => $u->created_at->format('M j, Y'),
                'created_ago'    => $u->created_at->diffForHumans(),
            ]);

        return Inertia::render('Admin/Users', [
            'users' => $users,
        ]);
    }

    public function feedback(Request $request): InertiaResponse
    {
        $query = FeedbackReport::with('user')->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $reports = $query->paginate(20)->through(fn ($f) => [
            'id'          => $f->id,
            'type'        => $f->type,
            'subject'     => $f->subject,
            'message'     => $f->message,
            'page'        => $f->page,
            'status'      => $f->status,
            'user_name'   => $f->user?->name ?? 'Guest',
            'user_email'  => $f->user?->email ?? '—',
            'created_at'  => $f->created_at->format('M j, Y'),
            'created_ago' => $f->created_at->diffForHumans(),
        ]);

        return Inertia::render('Admin/Feedback', [
            'reports' => $reports,
            'filters' => $request->only(['status', 'type']),
        ]);
    }

    public function updateFeedback(Request $request, FeedbackReport $report): RedirectResponse
    {
        $request->validate([
            'status' => ['required', 'in:new,reviewed,fixed,closed'],
        ]);

        $report->update(['status' => $request->status]);

        return back();
    }
}
