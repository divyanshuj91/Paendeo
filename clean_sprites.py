from PIL import Image
import collections

def clean_spritesheet(input_path, output_path):
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
            
            # We will perform BFS starting from all border pixels of this cell
            queue = collections.deque()
            visited = set()
            
            # Add top and bottom borders
            for dx in range(cell_w):
                queue.append((dx, 0))
                queue.append((dx, cell_h - 1))
                visited.add((dx, 0))
                visited.add((dx, cell_h - 1))
                
            # Add left and right borders
            for dy in range(1, cell_h - 1):
                queue.append((0, dy))
                queue.append((cell_w - 1, dy))
                visited.add((0, dy))
                visited.add((cell_w - 1, dy))
                
            # BFS to find all background pixels
            background_pixels = set()
            
            while queue:
                cx, cy = queue.popleft()
                gx = x_offset + cx
                gy = y_offset + cy
                
                r, g, b, a = pixels[gx, gy]
                
                # Check if this pixel is background-like:
                # 1. Magenta-like
                is_magenta = (r > 120 and b > 120 and g < 110)
                
                # 2. Grid-line-like: must be near grid coordinates and dark purple/black
                is_near_grid_x = (cx % 16 <= 1 or cx % 16 >= 15)
                is_near_grid_y = (cy % 16 <= 1 or cy % 16 >= 15)
                is_dark = (r < 120 and g < 50 and b < 120)
                is_grid_line = (is_near_grid_x or is_near_grid_y) and is_dark
                
                if is_magenta or is_grid_line:
                    background_pixels.add((cx, cy))
                    
                    # Add neighbors within the cell
                    for nx, ny in [(cx+1, cy), (cx-1, cy), (cx, cy+1), (cx, cy-1)]:
                        if 0 <= nx < cell_w and 0 <= ny < cell_h:
                            if (nx, ny) not in visited:
                                visited.add((nx, ny))
                                queue.append((nx, ny))
                                
            # Copy pixels to output: if it's a background pixel, leave transparent.
            # Otherwise copy from original image, keying out any leftover magenta.
            for cx in range(cell_w):
                for cy in range(cell_h):
                    gx = x_offset + cx
                    gy = y_offset + cy
                    
                    if (cx, cy) in background_pixels:
                        out_pixels[gx, gy] = (0, 0, 0, 0)
                    else:
                        r, g, b, a = pixels[gx, gy]
                        # Final check for magenta
                        if r > 120 and b > 120 and g < 110:
                            out_pixels[gx, gy] = (0, 0, 0, 0)
                        else:
                            out_pixels[gx, gy] = (r, g, b, a)
                            
    out_img.save(output_path)
    print(f"Cleaned sprite sheet saved to {output_path}")

if __name__ == "__main__":
    clean_spritesheet("panda_spritesheet.png", "panda_spritesheet_clean.png")
