import React, { useState, useEffect, useRef } from 'react';
import { generateClient } from 'aws-amplify/api';
const client = generateClient();
import { listAlerts } from '../../graphql/queries';
import { useFilter } from '../../context/FilterContext';
import { useMap } from '../../context/MapContext';

/**
 * TimelineVisualization component displays alerts over time with interactive elements
 * for exploring alert patterns and trends.
 */
const TimelineVisualization = () => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('week'); // 'day', 'week', 'month', 'year'
  const [groupBy, setGroupBy] = useState('day'); // 'hour', 'day', 'week', 'month'
  const { filters } = useFilter();
  const { getAlertSeverityColor } = useMap();
  const chartRef = useRef(null);

  // Fetch alert data for timeline visualization
  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        setLoading(true);
        
        // Calculate date range based on selected time range
        const endDate = new Date();
        const startDate = new Date();
        
        switch (timeRange) {
          case 'day':
            startDate.setDate(startDate.getDate() - 1);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          default:
            startDate.setDate(startDate.getDate() - 7); // Default to week
        }
        
        // Fetch alerts within the date range
        const response = await client.graphql({
          query: listAlerts,
          variables: {
            filter: {
              startTime: {
                between: [startDate.toISOString(), endDate.toISOString()]
              },
              ...filters
            },
            limit: 1000 // Fetch a large number for timeline analysis
          }
        });
        
        const alerts = response.data.listAlerts.items;
        
        // Process data for timeline visualization
        const processedData = processTimelineData(alerts, groupBy);
        setTimelineData(processedData);
        
        // Render the timeline chart
        if (processedData.length > 0) {
          renderTimelineChart(processedData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching timeline data:', err);
        setError(err);
        setLoading(false);
      }
    };
    
    fetchTimelineData();
  }, [timeRange, groupBy, filters, getAlertSeverityColor]);
  
  /**
   * Process alert data for timeline visualization
   * @param {Array} alerts - Array of alert objects
   * @param {String} groupBy - How to group the data ('hour', 'day', 'week', 'month')
   * @returns {Array} Processed data for visualization
   */
  const processTimelineData = (alerts, groupBy) => {
    if (!alerts || alerts.length === 0) return [];
    
    // Group alerts by time period and category
    const groupedData = {};
    
    alerts.forEach(alert => {
      const alertDate = new Date(alert.startTime || alert.createdAt);
      let timeKey;
      
      // Create time key based on groupBy
      switch (groupBy) {
        case 'hour':
          timeKey = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')} ${String(alertDate.getHours()).padStart(2, '0')}:00`;
          break;
        case 'day':
          timeKey = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')}`;
          break;
        case 'week':
          // Get the first day of the week (Sunday)
          const firstDayOfWeek = new Date(alertDate);
          const day = alertDate.getDay();
          firstDayOfWeek.setDate(alertDate.getDate() - day);
          timeKey = `Week of ${firstDayOfWeek.getFullYear()}-${String(firstDayOfWeek.getMonth() + 1).padStart(2, '0')}-${String(firstDayOfWeek.getDate()).padStart(2, '0')}`;
          break;
        case 'month':
          timeKey = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          timeKey = `${alertDate.getFullYear()}-${String(alertDate.getMonth() + 1).padStart(2, '0')}-${String(alertDate.getDate()).padStart(2, '0')}`;
      }
      
      // Initialize time period if it doesn't exist
      if (!groupedData[timeKey]) {
        groupedData[timeKey] = {
          timeKey,
          date: new Date(alertDate),
          total: 0,
          categories: {},
          severities: {}
        };
      }
      
      // Increment total count
      groupedData[timeKey].total++;
      
      // Increment category count
      const category = alert.category || 'UNKNOWN';
      groupedData[timeKey].categories[category] = (groupedData[timeKey].categories[category] || 0) + 1;
      
      // Increment severity count
      const severity = alert.severity || 'UNKNOWN';
      groupedData[timeKey].severities[severity] = (groupedData[timeKey].severities[severity] || 0) + 1;
    });
    
    // Convert to array and sort by date
    return Object.values(groupedData).sort((a, b) => a.date - b.date);
  };
  
  /**
   * Render the timeline chart using canvas
   * @param {Array} data - Processed timeline data
   */
  const renderTimelineChart = (data) => {
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
    
    // Find max value for scaling
    const maxValue = Math.max(...data.map(d => d.total));
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(chartMargin.left, chartMargin.top);
    ctx.lineTo(chartMargin.left, height - chartMargin.bottom);
    ctx.lineTo(width - chartMargin.right, height - chartMargin.bottom);
    ctx.strokeStyle = '#333';
    ctx.stroke();
    
    // Draw bars
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length * 0.2;
    
    data.forEach((d, i) => {
      const x = chartMargin.left + i * (barWidth + barSpacing) + barSpacing / 2;
      const barHeight = (d.total / maxValue) * chartHeight;
      const y = height - chartMargin.bottom - barHeight;
      
      // Draw bar
      ctx.fillStyle = '#2196f3';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw time label
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      
      // Format label based on groupBy
      let label;
      switch (groupBy) {
        case 'hour':
          label = d.timeKey.split(' ')[1];
          break;
        case 'day':
          label = d.timeKey.split('-')[2];
          break;
        case 'week':
          label = 'W' + Math.ceil(d.date.getDate() / 7);
          break;
        case 'month':
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          label = monthNames[d.date.getMonth()];
          break;
        default:
          label = d.timeKey.split('-')[2];
      }
      
      ctx.fillText(label, x + barWidth / 2, height - chartMargin.bottom + 15);
      
      // Draw value on top of bar
      ctx.fillText(d.total.toString(), x + barWidth / 2, y - 5);
    });
    
    // Draw y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= 5; i++) {
      const value = Math.round(maxValue * i / 5);
      const y = height - chartMargin.bottom - (i / 5) * chartHeight;
      
      ctx.fillText(value.toString(), chartMargin.left - 5, y);
      
      // Draw grid line
      ctx.beginPath();
      ctx.moveTo(chartMargin.left, y);
      ctx.lineTo(width - chartMargin.right, y);
      ctx.strokeStyle = '#eee';
      ctx.stroke();
    }
    
    // Draw title
    ctx.textAlign = 'center';
    ctx.font = '14px Arial';
    ctx.fillText('Alert Timeline', width / 2, chartMargin.top / 2);
  };
  
  // Handle time range change
  const handleTimeRangeChange = (e) => {
    setTimeRange(e.target.value);
  };
  
  // Handle group by change
  const handleGroupByChange = (e) => {
    setGroupBy(e.target.value);
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  return (
    <div className="timeline-visualization">
      <div className="timeline-controls">
        <div className="control-group">
          <label htmlFor="time-range">Time Range:</label>
          <select 
            id="time-range" 
            value={timeRange} 
            onChange={handleTimeRangeChange}
            aria-label="Select time range"
          >
            <option value="day">Last 24 Hours</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
          </select>
        </div>
        
        <div className="control-group">
          <label htmlFor="group-by">Group By:</label>
          <select 
            id="group-by" 
            value={groupBy} 
            onChange={handleGroupByChange}
            aria-label="Select grouping"
          >
            <option value="hour">Hour</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </div>
      
      {loading && <div className="timeline-loading">Loading timeline data...</div>}
      
      {error && <div className="timeline-error">Error loading timeline data: {error.message}</div>}
      
      {!loading && !error && timelineData.length === 0 && (
        <div className="timeline-empty">No alert data available for the selected time range.</div>
      )}
      
      {!loading && !error && timelineData.length > 0 && (
        <div className="timeline-chart-container">
          <canvas 
            ref={chartRef} 
            width={800} 
            height={300} 
            className="timeline-chart"
            aria-label="Alert timeline chart"
          ></canvas>
          
          <div className="timeline-summary">
            <h4>Summary</h4>
            <p>
              <strong>Total Alerts:</strong> {timelineData.reduce((sum, d) => sum + d.total, 0)}
            </p>
            <p>
              <strong>Time Period:</strong> {formatDate(timelineData[0].date)} to {formatDate(timelineData[timelineData.length - 1].date)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineVisualization;