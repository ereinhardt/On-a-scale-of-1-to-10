import os
import sys

def remove_first_n_chars(directory, n_chars):
    """
    Remove the first n characters from PNG filenames in the specified directory.
    
    Args:
        directory: Path to the folder containing PNG images
        n_chars: Number of characters to remove from the beginning of each filename
    """
    # Clean up the directory path (remove quotes and whitespace)
    directory = directory.strip().strip('"').strip("'")
    directory = os.path.expanduser(directory)  # Expand ~ to home directory
    
    # Check if the directory exists
    if not os.path.isdir(directory):
        print(f"Error: The directory '{directory}' does not exist.")
        return

    # Validate n_chars is a positive integer
    try:
        n_chars = int(n_chars)
        if n_chars < 0:
            print("Error: Number of characters must be positive.")
            return
    except ValueError:
        print("Error: Please provide a valid number.")
        return

    print(f"Processing images in: {directory}")
    print(f"Removing first {n_chars} character(s) from filenames...")
    print()

    count = 0
    skipped = 0
    
    # Iterate through all files in the directory
    for filename in os.listdir(directory):
        # Process only PNG files
        if filename.lower().endswith(".png"):
            # Remove the first n characters from filename (excluding extension)
            name_without_ext = filename[:-4]  # Remove .png
            
            # Check if filename is long enough
            if len(name_without_ext) <= n_chars:
                print(f"Skipped (too short): {filename}")
                skipped += 1
                continue
            
            # Create new filename by removing first n chars
            new_name_without_ext = name_without_ext[n_chars:]
            new_filename = f"{new_name_without_ext}.png"
            
            # Skip if the new filename would be the same
            if filename == new_filename:
                print(f"Skipped (no change): {filename}")
                skipped += 1
                continue
            
            old_path = os.path.join(directory, filename)
            new_path = os.path.join(directory, new_filename)
            
            # Check if target filename already exists
            if os.path.exists(new_path):
                print(f"Skipped (target exists): {filename} -> {new_filename}")
                skipped += 1
                continue
            
            try:
                os.rename(old_path, new_path)
                print(f"Renamed: {filename} -> {new_filename}")
                count += 1
            except OSError as e:
                print(f"Error renaming {filename}: {e}")
                skipped += 1

    print()
    print(f"Completed. {count} images were renamed, {skipped} skipped.")

if __name__ == "__main__":
    # Path and number of characters can be passed as arguments
    if len(sys.argv) > 2:
        target_dir = sys.argv[1]
        num_chars = sys.argv[2]
    else:
        target_dir = input("Please enter the path to the folder containing PNG images: ")
        num_chars = input("How many characters should be removed from the beginning? ")
    
    remove_first_n_chars(target_dir, num_chars)
