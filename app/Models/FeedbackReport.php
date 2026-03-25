<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackReport extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'subject',
        'message',
        'page',
        'related_project_id',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
