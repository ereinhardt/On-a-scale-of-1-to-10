import os
import uuid
import sys

def rename_images(directory):
    # Check if the directory exists
    if not os.path.isdir(directory):
        print(f"Error: The directory '{directory}' does not exist.")
        return

    print(f"Processing images in: {directory}")

    count = 0
    # Iterate through all files in the directory
    for filename in os.listdir(directory):
        # Skip macOS resource fork files
        if filename.startswith("._"):
            continue

        # Process only PNG files
        if filename.lower().endswith(".png"):
            # Generate a unique ID (UUID)
            unique_id = str(uuid.uuid4())
            
            if "__" in filename:
                prefix, rest = filename.split("__", 1)
                if prefix == "1024":
                    original_name = filename
                else:
                    original_name = rest
            else:
                original_name = filename

            # Create new filename: ID__OriginalFileName.png
            new_filename = f"{unique_id}__{original_name}"
            
            old_path = os.path.join(directory, filename)
            new_path = os.path.join(directory, new_filename)
            
            try:
                os.rename(old_path, new_path)
                print(f"Renamed: {filename} -> {new_filename}")
                count += 1
            except OSError as e:
                print(f"Error renaming {filename}: {e}")

    print(f"Completed. {count} images were renamed.")

if __name__ == "__main__":
    # Path can be passed as an argument or requested via input
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    else:
        target_dir = input("Please enter the path to the folder containing PNG images: ")
    
    # Remove quotes if the path contains them (e.g. via drag & drop)
    target_dir = target_dir.strip('"').strip("'")
    
    rename_images(target_dir)