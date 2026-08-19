const fs = require('fs');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const regex = /(if\s*\([^)]+\)\s*return[^;]*;)([\s\S]*?)(\buse[A-Z]\w*\()/;
    
    // We want to find cases where `if (...) return ...` occurs in a component,
    // and then later in the same file `use...` is called.
    // Let's just find `if (...) return` followed by `use...` inside the same { block }
    
    // Simpler: Just grep for any `return` followed by a hook in the same component.
});
