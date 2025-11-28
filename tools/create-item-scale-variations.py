import os
import sys
try:
    from PIL import Image
except ImportError:
    print("Error: Pillow library is not installed. Please install it using 'pip install Pillow'")
    sys.exit(1)

def create_scale_variations(directory):
    # Check if the directory exists
    if not os.path.isdir(directory):
        print(f"Error: The directory '{directory}' does not exist.")
        return

    print(f"Processing images in: {directory}")

    count = 0
    # Iterate through all files in the directory
    for filename in os.listdir(directory):
        # Process only PNG files
        if filename.lower().endswith(".png"):
            # Skip if it's already a variation (contains 512 or 256)
            if "__512__8bit__" in filename or "__256__8bit__" in filename:
                continue

            # Determine pattern to replace
            if "__1024__8bit__" in filename:
                pattern = "__1024__8bit__"
            elif "__8bit__" in filename:
                pattern = "__8bit__"
            else:
                continue
            
            old_path = os.path.join(directory, filename)
            
            try:
                with Image.open(old_path) as img:
                    # Check for Resampling enum (Pillow >= 10), fallback for older versions
                    if hasattr(Image, 'Resampling'):
                        resample_method = Image.Resampling.LANCZOS
                    else:
                        resample_method = Image.LANCZOS

                    # Define target sizes
                    target_sizes = [512, 256]

                    for size in target_sizes:
                        # Create new filename
                        if pattern == "__1024__8bit__":
                            new_filename = filename.replace(pattern, f"__{size}__8bit__")
                        else:
                            # Insert size before 8bit
                            new_filename = filename.replace(pattern, f"__{size}__8bit__")

                        new_path = os.path.join(directory, new_filename)
                        
                        action = "Created"
                        if os.path.exists(new_path):
                            action = "Overwritten"

                        # Resize
                        resized_img = img.resize((size, size), resample_method)
                        
                        # Save the new image
                        resized_img.save(new_path, format="PNG")
                        
                        print(f"{action}: {new_filename} ({size}x{size}) from {filename}")
                    
                count += 1
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    print(f"Completed. {count} images were processed.")

if __name__ == "__main__":
    # Path can be passed as an argument or requested via input
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    else:
        target_dir = input("Please enter the path to the folder containing PNG images: ")
    
    # Remove quotes if the path contains them (e.g. via drag & drop)
    target_dir = target_dir.strip('"').strip("'")
    
    create_scale_variations(target_dir)
