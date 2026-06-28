from PIL import Image
import collections
import os

def clean_spritesheet(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Error: {input_path} does not exist.")
        return
        
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    # Create a new transparent image for the output
    out_img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    out_pixels = out_img.load()
    
    cell_w, cell_h = 128, 128
    cols, rows = width // cell_w, height // cell_h
    
    for row in range(rows):
        for col in range(cols):
            x_offset = col * cell_w
            y_offset = row * cell_h
            
            # BFS queue starting from border pixels of this 128x128 cell
            queue = collections.deque()
            visited = set()
            
            # Add top and bottom border coordinates of the cell
            for dx in range(cell_w):
                queue.append((dx, 0))
                queue.append((dx, cell_h - 1))
                visited.add((dx, 0))
                visited.add((dx, cell_h - 1))
                
            # Add left and right border coordinates of the cell
            for dy in range(1, cell_h - 1):
                queue.append((0, dy))
                queue.append((cell_w - 1, dy))
                visited.add((0, dy))
                visited.add((cell_w - 1, dy))
                
            background_pixels = set()
            
            while queue:
                cx, cy = queue.popleft()
                gx = x_offset + cx
                gy = y_offset + cy
                
                r, g, b = pixels[gx, gy][:3]
                
                # Check if this pixel is background-like:
                # 1. Magenta background (any shade of pink/magenta where green is low relative to R and B)
                is_magenta = (r > 80 and b > 80 and g < 150 and g < r - 20 and g < b - 20)
                
                # 2. Grid-line-like: close to the 128x128 cell boundaries and is dark purple or black/grey
                is_near_border = (cx <= 4 or cx >= 123 or cy <= 4 or cy >= 123)
                
                is_dark = (r < 60 and g < 60 and b < 60)
                is_purple_tint = (g < r - 4 and g < b - 4)
                
                is_grid_line = is_near_border and (is_dark or is_purple_tint)
                
                if is_magenta or is_grid_line:
                    background_pixels.add((cx, cy))
                    
                    # Add neighbors within the cell
                    for nx, ny in [(cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)]:
                        if 0 <= nx < cell_w and 0 <= ny < cell_h:
                            if (nx, ny) not in visited:
                                visited.add((nx, ny))
                                queue.append((nx, ny))
                                
            # Copy pixels to output: if it's marked as background/grid, leave it transparent.
            # Otherwise, copy the original pixel and force outer 1px buffer to be 100% transparent.
            for cx in range(cell_w):
                for cy in range(cell_h):
                    gx = x_offset + cx
                    gy = y_offset + cy
                    
                    if (cx, cy) in background_pixels:
                        out_pixels[gx, gy] = (0, 0, 0, 0)
                    else:
                        r, g, b = pixels[gx, gy][:3]
                        # Final safety check for leftover magenta pixels
                        if r > 80 and b > 80 and g < r - 20 and g < b - 20:
                            out_pixels[gx, gy] = (0, 0, 0, 0)
                        else:
                            # Force a 1px transparent gutter at the very edges of each cell 
                            # to prevent texture filtering bleed/scaling artifacts
                            if cx == 0 or cx == cell_w - 1 or cy == 0 or cy == cell_h - 1:
                                out_pixels[gx, gy] = (0, 0, 0, 0)
                            else:
                                out_pixels[gx, gy] = (r, g, b, 255)
                                
    out_img.save(output_path)
    print(f"Cleaned sprite sheet successfully saved to {output_path}")

if __name__ == "__main__":
    clean_spritesheet("panda_spritesheet.png", "src/assets/panda_spritesheet_clean.png")
