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
    const lines = content.split('\n');
    let insideComponent = false;
    let hasEarlyReturn = false;
    let bracketLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Detect component start (rough heuristic)
        if (line.match(/export (default )?function [A-Z]/)) {
            insideComponent = true;
            hasEarlyReturn = false;
            bracketLevel = 0;
        }
        
        if (insideComponent) {
            bracketLevel += (line.match(/\{/g) || []).length;
            bracketLevel -= (line.match(/\}/g) || []).length;
            
            // If we are at the top level of the component and see a return
            if (bracketLevel === 1 && line.match(/\breturn\b/) && !line.match(/=>/)) {
                hasEarlyReturn = true;
            }
            
            // If we have seen a top-level return and now see a hook
            if (hasEarlyReturn && line.match(/\buse[A-Z]/)) {
                console.log(`${file}:${i+1} Hook called after early return! Line: ${line.trim()}`);
            }
            
            if (bracketLevel === 0 && line.match(/\}/)) {
                insideComponent = false;
            }
        }
    }
});
