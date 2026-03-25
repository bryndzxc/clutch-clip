<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Default processing preferences — merged with any per-user overrides.
     * These values are passed to the Python processing script as CLI flags.
     */
    public const DEFAULT_SETTINGS = [
        'clip_count'        => 5,     // max clips to generate
        'pre_roll'          => 3,     // seconds before highlight peak
        'post_roll'         => 3,     // seconds after highlight peak
        'merge_gap'         => 5,     // gap (s) below which adjacent clips merge
        'min_score'         => 50,    // minimum intensity score (0–100)
        'output_quality'    => 'high',     // standard | high | smaller
        'resolution'        => '1080p',    // 720p | 1080p
        'aspect_ratio'      => 'original', // original | vertical
        'auto_delete_hours' => 168,        // 24 | 48 | 168 (7 days)
    ];

    /**
     * Return the user's effective settings, merged over the defaults.
     *
     * @return array<string, mixed>
     */
    public function getSettings(): array
    {
        return array_merge(self::DEFAULT_SETTINGS, $this->settings ?? []);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'avatar',
        'settings',
        'is_admin',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
            'settings'          => 'array',
            'is_admin'          => 'boolean',
        ];
    }

    public function montageProjects(): HasMany
    {
        return $this->hasMany(MontageProject::class);
    }

    public function montages(): HasMany
    {
        return $this->hasMany(Montage::class);
    }

    public function feedbackReports(): HasMany
    {
        return $this->hasMany(FeedbackReport::class);
    }

    public function isAdmin(): bool
    {
        return (bool) $this->is_admin;
    }
}
