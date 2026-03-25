<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <!-- SEO -->
    <title>ClutchClip - AI Gaming Highlight Generator</title>
    <meta name="description" content="Automatically generate gaming highlights using AI. Upload your gameplay and get clips instantly for TikTok, YouTube, and Facebook.">
    <meta name="keywords" content="gaming highlights, AI video editor, montage maker, valorant clips, clutch clips, gaming montage">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{{ config('app.url') }}">

    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="ClutchClip - AI Gaming Highlight Generator">
    <meta property="og:description" content="Automatically generate gaming highlights using AI. Upload your gameplay and get clips instantly for TikTok, YouTube, and Facebook.">
    <meta property="og:image" content="{{ config('app.url') }}/storage/main_logo.png">
    <meta property="og:url" content="{{ config('app.url') }}">
    <meta property="og:site_name" content="ClutchClip">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="ClutchClip - AI Gaming Highlight Generator">
    <meta name="twitter:description" content="Automatically generate gaming highlights using AI. Upload your gameplay and get clips instantly.">
    <meta name="twitter:image" content="{{ config('app.url') }}/storage/main_logo.png">

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="/storage/icon.png">
    <link rel="shortcut icon" href="/storage/icon.png">
    <link rel="apple-touch-icon" href="/storage/icon.png">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead
</head>
<body class="bg-gray-950 text-white antialiased">
    @inertia
</body>
</html>
