const fs = require('fs');
const content = fs.readFileSync('data.js', 'utf8');
const dates = content.match(/\d{4}-\d{2}-\d{2}/g);
if (dates) {
    dates.sort((a, b) => b.localeCompare(a));
    console.log('Latest date:', dates[0]);
} else {
    console.log('No dates found');
}
