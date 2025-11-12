// script.js

// --- 1. SIMULATED DATA (Replace with your Google Sheets URLs later) ---
const frameworkData = [
    {ID: "G-01", Name: "Basic Computation", Grade: "K"},
    {ID: "G-02", Name: "Phonological Awareness", Grade: "1"},
    {ID: "G-03", Name: "Simple Measurement", Grade: "1"},
    {ID: "G-04", Name: "Introduction to History", Grade: "2"},
    {ID: "G-05", Name: "Ecosystems", Grade: "3"},
    {ID: "G-06", Name: "Decimals and Fractions", Grade: "4"},
    {ID: "G-07", Name: "Essay Structure", Grade: "5"},
    {ID: "G-08", Name: "Algebraic Thinking", Grade: "6"},
    {ID: "G-09", Name: "Constitutional Law", Grade: "8"},
    {ID: "G-10", Name: "Scientific Inquiry", Grade: "9"},
    // ... imagine 57 more goals here for the full 67 ...
];

// This simulates the data staff would enter into Google Sheets
const programData = [
    {Program_Name: "Math Club", Goals_Covered: "G-06, G-08", Rigor: "High", Program_Type: "District"},
    {Program_Name: "Summer Literacy", Goals_Covered: "G-02, G-07", Rigor: "Medium", Program_Type: "District"},
    {Program_Name: "Community Tutoring", Goals_Covered: "G-01, G-02, G-03, G-06", Rigor: "Low", Program_Type: "Community"},
    {Program_Name: "History Bee Prep", Goals_Covered: "G-04, G-09", Rigor: "High", Program_Type: "Community"},
    {Program_Name: "Science Camp", Goals_Covered: "G-05, G-10", Rigor: "Medium", Program_Type: "Community"},
    {Program_Name: "Advanced Study Group", Goals_Covered: "G-06, G-08, G-09", Rigor: "High", Program_Type: "District"}, 
    // Example OVERLAP on G-06 and G-08 in the 'High' Rigor category
];
// --- END SIMULATED DATA ---

// Placeholder URLs (Uncomment and replace with your published Sheet URLs later)
// const FRAMEWORK_URL = "URL_FOR_SHEET_1_FRAMEWARE";
// const PROGRAM_URL = "URL_FOR_SHEET_2_PROGRAMS";

// Dimensions and Setup
const margin = {top: 50, right: 20, bottom: 20, left: 180},
      width = 700 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom; // Adjust height for 67 goals!

const svg = d3.select("#timeline-chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");
const categoryOptions = ["Rigor", "Program_Type"]; 
let yScale; // Will hold the Y-Axis scale

// --- 2. INITIALIZATION ---

function initializeChart(frameworkData, programData) {
    // 1. Setup the static Y-Axis
    setupYAxis(frameworkData); 
    
    // 2. Setup the dynamic X-Axis Selector
    setupCategorySelector(programData);
}

// Y-Axis (Goals) Setup
function setupYAxis(frameworkData) {
    const goalIDs = frameworkData.map(d => d.ID); 
    
    // Adjust height based on the number of goals (for 67, this needs to be much larger)
    const dynamicHeight = goalIDs.length * 20; 
    d3.select("#timeline-chart").attr("height", dynamicHeight + margin.top + margin.bottom);
    
    yScale = d3.scaleBand()
        .domain(goalIDs) 
        .range([0, dynamicHeight])
        .paddingInner(0.1); 

    // Draw the Y-axis (Goal Names)
    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale).tickFormat(d => frameworkData.find(g => g.ID === d).Name || d))
        .selectAll("text")
        .attr("dy", ".32em")
        .style("text-anchor", "end");
}

// Category Selector Setup
function setupCategorySelector(programData) {
    d3.select("#categorySelector")
        .selectAll("option")
        .data(categoryOptions)
        .enter()
        .append("option")
        .text(d => d.replace(/_/g, ' '))
        .attr("value", d => d);

    // Initial draw
    const initialCategory = categoryOptions[0];
    drawChart(initialCategory, programData);

    // Listener for change
    d3.select("#categorySelector").on("change", function() {
        const newCategory = d3.select(this).property("value");
        drawChart(newCategory, programData);
    });
}

// --- 3. CORE LOGIC: DRAW CHART & AGGREGATE DATA ---

function getColor(programCount) {
    if (programCount >= 2) {
        return "#c0392b"; // Red for Overlap
    } else if (programCount === 1) {
        return "#3498db"; // Blue for Coverage
    } else {
        return "transparent";
    }
}

function drawChart(categoryKey, allProgramData) {
    // A. Data Aggregation
    const nestedData = d3.group(allProgramData, d => d[categoryKey]);
    const cellData = [];

    for (const [categoryValue, programsInGroup] of nestedData) {
        let goalProgramsMap = new Map(); 

        programsInGroup.forEach(program => {
            const goalsCoveredArray = program.Goals_Covered.split(',').map(g => g.trim());
            
            goalsCoveredArray.forEach(goalId => {
                const currentPrograms = goalProgramsMap.get(goalId) || [];
                currentPrograms.push(program.Program_Name); 
                goalProgramsMap.set(goalId, currentPrograms);
            });
        });

        for (const [goalId, programNames] of goalProgramsMap) {
            // Only goals defined in the framework should be drawn
            if (yScale.domain().includes(goalId)) { 
                cellData.push({
                    goalId: goalId,
                    category: categoryValue,
                    programCount: programNames.length,
                    programNames: programNames 
                });
            }
        }
    }

    // B. X-Axis Setup
    const categoryDomains = [...new Set(allProgramData.map(d => d[categoryKey]))].sort();

    const xScale = d3.scaleBand()
        .domain(categoryDomains)
        .range([0, width])
        .paddingInner(0.1);

    // Redraw X-Axis
    svg.selectAll(".x-axis").remove();
    svg.append("g")
        .attr("class", "x-axis")
        .call(d3.axisTop(xScale)); 

    // C. Drawing Cells (Rectangles)
    const cells = svg.selectAll(".coverage-cell")
        .data(cellData, d => d.goalId + d.category);

    // EXIT (remove old cells)
    cells.exit().remove();

    // ENTER + UPDATE (draw new/update existing cells)
    cells.enter()
        .append("rect")
        .attr("class", "coverage-cell")
        .merge(cells) 
        .attr("x", d => xScale(d.category))
        .attr("y", d => yScale(d.goalId))
        .attr("width", xScale.bandwidth())
        .attr("height", yScale.bandwidth())
        .attr("fill", d => getColor(d.programCount))
        
        // --- Tooltip Interactivity ---
        .on("mouseover", function(event, d) {
            tooltip.style("visibility", "visible");
            d3.select(this).attr("stroke", "#2c3e50").attr("stroke-width", 2);
        })
        .on("mousemove", function(event, d) {
            tooltip.style("left", (event.pageX + 10) + "px")     
                   .style("top", (event.pageY - 20) + "px")
                   .html(`
                       <strong>Goal:</strong> ${d.goalId} (${frameworkData.find(g => g.ID === d.goalId)?.Name || 'N/A'})<br>
                       <strong>Category:</strong> ${d.category}<br>
                       <strong>Programs:</strong> ${d.programNames.join(", ")}<br>
                       ${d.programCount >= 2 ? `<strong>Overlap: ${d.programCount} programs</strong>` : 'Coverage'}
                   `);
        })
        .on("mouseout", function() {
            tooltip.style("visibility", "hidden");
            d3.select(this).attr("stroke", "none");
        });
}

// Start the whole process
// In a real application, you would replace this with the Promise.all logic:
// Promise.all([d3.csv(FRAMEWORK_URL), d3.csv(PROGRAM_URL)]).then(([f, p]) => initializeChart(f, p));

// For this runnable example, we use the local data:
initializeChart(frameworkData, programData);
