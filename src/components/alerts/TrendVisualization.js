import React, { useState, useEffect, useRef } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { listAlerts } from '../../graphql/queries';
import { useFilter } from '../../context/FilterContext';
import { useMap } from '../../context/MapContext';

/**
 * TrendVisualization component displays trends in alert data over time,
 * such as category distribution, severity changes, and pattern detection.
 */
const TrendVisualization = () => {
  const [trendData, setTrendData] = useState({
    categories: {},
    severities: {},
    sources: {},
    trends: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visualizationType, setVisualizationType] = useState('category'); // 'category', 'severity', 'source'
  const { filters } = useFilter();
  const { getAlertSeverityColor, getAlertCategoryIcon } = useMap();
  const chartRef = useRef(null);

  // Fetch alert data for trend visualization
  useEffect(() => {
    const fetchTrendData = async () => {
      try {
        setLoading(true);
        
        // Calculate date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Fetch alerts within the date range
        const response = await API.graphql(
          graphqlOperation(listAlerts, {
            filter: {
              startTime: {
                between: [startDate.toISOString(), endDate.toISOString()]
              },
              ...filters
            },
            limit: 1000 // Fetch a large number for trend analysis
          })
        );
        
        const alerts = response.data.listAlerts.items;
        
        // Process data for trend visualization
        const processedData = processTrendData(alerts);
        setTrendData(processedData);
        
        // Render the trend chart
        renderTrendChart(processedData, visualizationType);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching trend data:', err);
        setError(err);
        setLoading(false);
      }
    };
    
    fetchTrendData();
  }, [filters, visualizationType, getAlertSeverityColor, getAlertCategoryIcon]);
  
  /**
   * Process alert data for trend visualization
   * @param {Array} alerts - Array of alert objects
   * @returns {Object} Processed data for visualization
   */
  const processTrendData = (alerts) => {
    if (!alerts || alerts.length === 0) {
      return {
        categories: {},
        severities: {},
        sources: {},
        trends: []
      };
    }
    
    // Initialize data structures
    const categories = {};
    const severities = {};
    const sources = {};
    const weeklyTrends = {};
    
    // Process each alert
    alerts.forEach(alert => {
      const alertDate = new Date(alert.startTime || alert.createdAt);
      const category = alert.category || 'UNKNOWN';
      const severity = alert.severity || 'UNKNOWN';
      const source = alert.sourceType || 'UNKNOWN';
      
      // Increment category count
      categories[category] = (categories[category] || 0) + 1;
      
      // Increment severity count
      severities[severity] = (severities[severity] || 0) + 1;
      
      // Increment source count
      sources[source] = (sources[source] || 0) + 1;
      
      // Group by week for trend analysis
      const weekStart = new Date(alertDate);
      weekStart.setDate(alertDate.getDate() - alertDate.getDay()); // Set to Sunday
      const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      
      if (!weeklyTrends[weekKey]) {
        weeklyTrends[weekKey] = {
          week: weekKey,
          date: new Date(weekStart),
          categories: {},
          severities: {},
          sources: {},
          total: 0
        };
      }
      
      // Increment weekly counts
      weeklyTrends[weekKey].total++;
      weeklyTrends[weekKey].categories[category] = (weeklyTrends[weekKey].categories[category] || 0) + 1;
      weeklyTrends[weekKey].severities[severity] = (weeklyTrends[weekKey].severities[severity] || 0) + 1;
      weeklyTrends[weekKey].sources[source] = (weeklyTrends[weekKey].sources[source] || 0) + 1;
    });
    
    // Convert weekly trends to array and sort by date
    const trends = Object.values(weeklyTrends).sort((a, b) => a.date - b.date);
    
    return {
      categories,
      severities,
      sources,
      trends
    };
  };
  
  /**
   * Render the trend chart using canvas
   * @param {Object} data - Processed trend data
   * @param {String} type - Type of visualization ('category', 'severity', 'source')
   */
  const renderTrendChart = (data, type) => {
    if (!chartRef.current) return;
    
    const canvas = chartRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set chart dimensions
    const chartMargin = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartWidth = width - chartMargin.left - chartMargin.right;
    const chartHeight = height - chartMargin.top - chartMargin.bottom;
    
    // Get data based on visualization type
    let chartData;
    let title;
    
    switch (type) {
      case 'category':
        chartData = data.categories;
        title = 'Alerts by Category';
        break;
      case 'severity':
        chartData = data.severities;
        title = 'Alerts by Severity';
        break;
      case 'source':
        chartData = data.sources;
        title = 'Alerts by Source';
        break;
      default:
        chartData = data.categories;
        title = 'Alerts by Category';
    }
    
    // Convert to array for easier processing
    const chartItems = Object.entries(chartData).map(([key, value]) => ({ key, value }));
    
    // Sort by value (descending)
    chartItems.sort((a, b) => b.value - a.value);
    
    // Draw pie chart
    const centerX = chartMargin.left + chartWidth / 2;
    const centerY = chartMargin.top + chartHeight / 2;
    const radius = Math.min(chartWidth, chartHeight) / 2;
    
    let startAngle = 0;
    const total = chartItems.reduce((sum, item) => sum + item.value, 0);
    
    // Define colors for different types
    const getColor = (key, index) => {
      if (type === 'severity') {
        return getAlertSeverityColor(key) || `hsl(${index * 30}, 70%, 60%)`;
      } else {
        return `hsl(${index * 30}, 70%, 60%)`;
      }
    };
    
    // Draw pie slices
    chartItems.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      ctx.fillStyle = getColor(item.key, index);
      ctx.fill();
      
      // Draw slice label if slice is big enough
      if (sliceAngle > 0.2) {
        const labelAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.7;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.key, labelX, labelY);
      }
      
      startAngle = endAngle;
    });
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, width / 2, 10);
    
    // Draw legend
    const legendX = width - chartMargin.right - 150;
    const legendY = chartMargin.top;
    const legendItemHeight = 20;
    
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial';
    
    chartItems.forEach((item, index) => {
      const y = legendY + index * legendItemHeight;
      
      // Draw color box
      ctx.fillStyle = getColor(item.key, index);
      ctx.fillRect(legendX, y, 15, 15);
      
      // Draw label
      ctx.fillStyle = '#333';
      ctx.fillText(`${item.key}: ${item.value} (${Math.round(item.value / total * 100)}%)`, legendX + 20, y + 7);
    });
  };
  
  // Handle visualization type change
  const handleVisualizationTypeChange = (e) => {
    setVisualizationType(e.target.value);
  };
  
  // Identify trends and patterns in the data
  const identifyTrends = () => {
    const { trends } = trendData;
    if (!trends || trends.length < 2) return [];
    
    const identifiedTrends = [];
    
    // Check for increasing trends in total alerts
    let increasingWeeks = 0;
    for (let i = 1; i < trends.length; i++) {
      if (trends[i].total > trends[i-1].total) {
        increasingWeeks++;
      }
    }
    
    if (increasingWeeks >= Math.floor(trends.length / 2)) {
      identifiedTrends.push({
        type: 'increasing',
        description: `Alert volume has been increasing for ${increasingWeeks} out of the last ${trends.length} weeks.`
      });
    }
    
    // Check for dominant categories
    const lastWeek = trends[trends.length - 1];
    if (lastWeek) {
      const categories = Object.entries(lastWeek.categories);
      categories.sort((a, b) => b[1] - a[1]);
      
      if (categories.length > 0 && categories[0][1] > lastWeek.total * 0.5) {
        identifiedTrends.push({
          type: 'dominant',
          description: `${categories[0][0]} alerts account for over 50% of recent alerts.`
        });
      }
    }
    
    // Check for severity shifts
    const firstWeek = trends[0];
    const lastWeekSeverities = lastWeek ? Object.entries(lastWeek.severities) : [];
    const firstWeekSeverities = firstWeek ? Object.entries(firstWeek.severities) : [];
    
    if (lastWeekSeverities.length > 0 && firstWeekSeverities.length > 0) {
      // Find highest severity in first and last week
      lastWeekSeverities.sort((a, b) => b[1] - a[1]);
      firstWeekSeverities.sort((a, b) => b[1] - a[1]);
      
      if (lastWeekSeverities[0][0] !== firstWeekSeverities[0][0]) {
        identifiedTrends.push({
          type: 'severity',
          description: `Predominant severity has shifted from ${firstWeekSeverities[0][0]} to ${lastWeekSeverities[0][0]}.`
        });
      }
    }
    
    return identifiedTrends;
  };
  
  const trends = identifyTrends();
  
  return (
    <div className="trend-visualization">
      <div className="trend-controls">
        <div className="control-group">
          <label htmlFor="visualization-type">Visualization Type:</label>
          <select 
            id="visualization-type" 
            value={visualizationType} 
            onChange={handleVisualizationTypeChange}
            aria-label="Select visualization type"
          >
            <option value="category">By Category</option>
            <option value="severity">By Severity</option>
            <option value="source">By Source</option>
          </select>
        </div>
      </div>
      
      {loading && <div className="trend-loading">Loading trend data...</div>}
      
      {error && <div className="trend-error">Error loading trend data: {error.message}</div>}
      
      {!loading && !error && Object.keys(trendData.categories).length === 0 && (
        <div className="trend-empty">No alert data available for trend analysis.</div>
      )}
      
      {!loading && !error && Object.keys(trendData.categories).length > 0 && (
        <div className="trend-chart-container">
          <canvas 
            ref={chartRef} 
            width={800} 
            height={400} 
            className="trend-chart"
            aria-label="Alert trend chart"
          ></canvas>
          
          {trends.length > 0 && (
            <div className="trend-insights">
              <h4>Identified Trends</h4>
              <ul className="trend-list">
                {trends.map((trend, index) => (
                  <li key={index} className={`trend-item trend-${trend.type}`}>
                    {trend.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TrendVisualization;