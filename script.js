// script.js

// --- 1. USER INPUT: PASTE YOUR PUBLISHED GOOGLE SHEET CSV URLs HERE ---
const FRAMEWORK_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpPudMuby9FvHz-XPkMI7CwQ2QPkm6E8mPr8dQj07Va3Q_tIvo4_AfyhjX5YxgQyWfVIscRqdA9wuV/pub?output=csv";
const PROGRAM_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRrjvzfjIw_94rvnndwyogjC_NZ2Z_nNZqdOyyUoybkqk0YaCj8SSb0LQeZDMmDA0qWdmGYAkpZIDJv/pub?output=csv";
// --- END USER INPUT ---

// Dimensions and Setup
const margin = {top: 50, right: 20, bottom: 20, left: 100},
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
let allFrameworkData; 

// --- 2. INITIALIZATION (Loads Data from URLs) ---

function initializeChart() {
    // Use Promise.all to ensure both CSV files load before drawing
    Promise.all([
        d3.csv(FRAMEWORK_URL),
        d3.csv(PROGRAM_URL)
    ]).then(([frameworkData, programData]) => {
        
        if (!frameworkData || !programData) {
            console.error("Failed to load data from Google Sheet URLs. Please ensure URLs are correct and sheets are published.");
            return;
        }

        allFrameworkData = frameworkData;
        
        // 1. Setup the static Y-Axis (Handles the 67 Steps)
        setupYAxis(frameworkData); 
        
        // 2. Setup the dynamic X-Axis Selector
        setupCategorySelector(programData);

    }).catch(error => {
        console.error("An error occurred during data loading:", error);
    });
}

// Y-Axis (Goals) Setup
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
        // Use the Name property from the framework data for the tick label
        .call(d3.axisLeft(yScale).tickFormat(d => frameworkData.find(g => g.ID === d)?.Name || d)) 
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
            // Split the Goals_Covered string, handling potential spaces/commas
            const goalsCoveredArray = program.Goals_Covered ? program.Goals_Covered.split(',').map(g => g.trim()) : [];
            
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
    // Use Array.from(new Set(...)) for IE/older browser compatibility 
    const categoryDomains = Array.from(new Set(allProgramData.map(d => d[categoryKey]))).filter(d => d).sort();

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
            // Find the Step Name for the tooltip using the global framework data
            const goalName = allFrameworkData.find(g => g.ID === d.goalId)?.Name || d.goalId;

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

// Start the process by loading the data
initializeChart();
