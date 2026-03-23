import os

dirs = [
    r'e:\laragon\www\clutch-clip-new\app\Console\Commands',
    r'e:\laragon\www\clutch-clip-new\storage\app\temp\uploads',
    r'e:\laragon\www\clutch-clip-new\storage\app\public\clips',
    r'e:\laragon\www\clutch-clip-new\storage\app\public\thumbnails'
]

for dir_path in dirs:
    os.makedirs(dir_path, exist_ok=True)
    print(f'Created: {dir_path}')

print("\nAll directories created successfully!")
