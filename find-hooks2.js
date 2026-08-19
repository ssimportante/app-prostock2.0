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
    // split by function or component
    const blocks = content.split(/(?=export (?:default )?function\b)/);
    blocks.forEach(block => {
        // Find first early return
        const returnMatch = block.match(/return[\s\S]*?;/);
        if (returnMatch) {
            const afterReturn = block.substring(returnMatch.index + returnMatch[0].length);
            if (afterReturn.match(/\buse[A-Z]\w*\(/)) {
                console.log("Hook after first return in:", file);
            }
        }
    });
});
