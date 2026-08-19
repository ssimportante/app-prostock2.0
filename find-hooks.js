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
    if (content.match(/if\s*\(.*\)\s*return.*[\s\S]*\buse[A-Z]/)) {
        console.log("Found early return before hook in:", file);
    }
});
