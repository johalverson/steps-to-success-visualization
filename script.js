// script.js

// --- 1. SIMULATED DATA (Updated for 67 Steps) ---

// Generate 67 sequential goals for the Y-Axis
const frameworkData = [];
for (let i = 1; i <= 67; i++) {
    frameworkData.push({
        ID: `G-${i.toString().padStart(2, '0')}`, 
        Name: `Step ${i}`, 
        Grade: Math.ceil(i / 6) // Dummy Grade for reference
    });
}

// This simulates the data staff would enter into Google Sheets. 
// Note: The Goals_Covered now references the new IDs (G-01 to G-67).
const programData = [
    // Example programs referencing the new G-XX IDs
    {Program_Name: "Foundational Math", Goals_Covered: "G-01, G-02, G-03, G-04", Rigor: "Low", Program_Type: "District"},
    {Program_Name: "Literacy Workshop", Goals_Covered: "G-05, G-06, G-07, G-08, G-09", Rigor: "Medium", Program_Type: "District"},
    {Program_Name: "Community Mentoring", Goals_Covered: "G-01, G-04, G-05, G-10, G-15", Rigor: "Low", Program_Type: "Community"},
    {Program_Name: "Advanced Algebra Prep", Goals_Covered: "G-10, G-11, G-12, G-13", Rigor: "High", Program_Type: "District"},
    {Program_Name: "Science Capstone", Goals_Covered: "G-14, G-15, G-16, G-17", Rigor: "High", Program_Type: "Community"},
    // Example OVERLAP on G-10 and G-15
    {Program_Name: "STEM Enrichment", Goals_Covered: "G-10, G-15, G-18, G-19", Rigor: "Medium", Program_Type: "District"}, 
    // Example data further down the curriculum
    {Program_Name: "Senior Projects", Goals_Covered: "G-60, G-61, G-62, G-63, G-64, G-65, G-66, G-67", Rigor: "High", Program_Type: "District"},
];
// --- END SIMULATED DATA ---

// Dimensions and Setup
const margin = {top: 50, right: 20, bottom: 20, left: 100}, // Reduced left margin since Step X is shorter
      width = 700 - margin.left - margin.right,
      height = 500 - margin.top - margin.bottom; 

const svg = d3.select("#timeline-chart")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select("#tooltip");
const categoryOptions = ["Rigor", "Program_Type"]; 
let yScale; 

// --- 2. INITIALIZATION ---

function initializeChart(frameworkData, programData) {
    // 1. Setup the static Y-Axis (Handles the 67 Steps)
    setupYAxis(frameworkData); 
    
    // 2. Setup the dynamic X-Axis Selector
    setupCategorySelector(programData);
}

// Y-Axis (Goals) Setup - MODIFIED
function setupYAxis(frameworkData) {
    const goalIDs = frameworkData.map(d => d.ID); 
    
    // Calculate a height suitable for 67 goals (e.g., 18 pixels per step)
    const stepHeight = 18; 
    const dynamicHeight = goalIDs.length * stepHeight; 
    d3.select("#timeline-chart").attr("height", dynamicHeight + margin.top + margin.bottom);
    
    yScale = d3.scaleBand()
        .domain(goalIDs) 
        .range([0, dynamicHeight])
        .paddingInner(0.1); 

    // Draw the Y-axis (Now uses "Step X" instead of goal names)
    svg.append("g")
        .attr("class", "y-axis")
        // The tickFormat now uses the Name property, which is "Step X"
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
            // Find the Step Name for the tooltip
            const goalName = frameworkData.find(g => g.ID === d.goalId)?.Name || d.goalId;

            tooltip.style("left", (event.pageX + 10) + "px")     
                   .style("top", (event.pageY - 20) + "px")
                   .html(`
                       <strong>Goal:</strong> ${goalName}<br>
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
initializeChart(frameworkData, programData);
