// Import React and hooks for state management and side effects.
import React, { useState, useEffect } from 'react';
// Import Tremor UI components for card layouts and text display.
import { Card, Title, Text } from '@tremor/react';
// Import icons from lucide-react to be used in the UI.
import { TrendingUp, DollarSign, Home, Map, X } from 'lucide-react';
// Import Recharts components for rendering charts.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
// Import axios in case you decide to fetch data from an API endpoint.
import axios from 'axios';

// Define the structure for price data records.
interface PriceData {
  year: number;
  month: number;
  town: string;
  flat_type: string;
  price: number;
}

// Main Analytics component to display market analytics and visual data.
const Analytics = () => {
  // State to store price data records.
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  // State for filtering data by selected year. 'ALL' means no year filter.
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  // State for filtering data by selected towns, limited to a maximum selection.
  const [selectedTowns, setSelectedTowns] = useState<string[]>(['ANG MO KIO', 'TAMPINES', 'WOODLANDS', 'PUNGGOL', 'JURONG EAST']);
  // State to control the visibility of the town selection dropdown.
  const [showTownDropdown, setShowTownDropdown] = useState(false);
  // State to track if data is currently being loaded.
  const [loading, setLoading] = useState(true);

  // Define an array of selectable years (including 'ALL' to reset filter).
  const years = ['ALL', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
  
  // List of towns available for filtering; sorted alphabetically.
  const towns = [
    'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
    'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
    'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
    'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
    'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
    'TOA PAYOH', 'WOODLANDS', 'YISHUN'
  ].sort();

  // Static data to simulate API response. This is constructed dynamically for different years and towns.
  // Each record represents a 4 ROOM flat's price at a given time.
  const staticData = [
    // 2017 data for all towns
    ...towns.flatMap(town => [
      { year: 2017, month: 1, town, flat_type: '4 ROOM', price: 350000 + Math.random() * 100000 },
      { year: 2017, month: 6, town, flat_type: '4 ROOM', price: 360000 + Math.random() * 100000 },
      { year: 2017, month: 12, town, flat_type: '4 ROOM', price: 370000 + Math.random() * 100000 },
    ]),
    // 2018 data for all towns
    ...towns.flatMap(town => [
      { year: 2018, month: 1, town, flat_type: '4 ROOM', price: 380000 + Math.random() * 100000 },
      { year: 2018, month: 6, town, flat_type: '4 ROOM', price: 390000 + Math.random() * 100000 },
      { year: 2018, month: 12, town, flat_type: '4 ROOM', price: 400000 + Math.random() * 100000 },
    ]),
    // 2019 data for all towns
    ...towns.flatMap(town => [
      { year: 2019, month: 1, town, flat_type: '4 ROOM', price: 410000 + Math.random() * 100000 },
      { year: 2019, month: 6, town, flat_type: '4 ROOM', price: 420000 + Math.random() * 100000 },
      { year: 2019, month: 12, town, flat_type: '4 ROOM', price: 430000 + Math.random() * 100000 },
    ]),
    // 2020 data for all towns
    ...towns.flatMap(town => [
      { year: 2020, month: 1, town, flat_type: '4 ROOM', price: 440000 + Math.random() * 100000 },
      { year: 2020, month: 6, town, flat_type: '4 ROOM', price: 450000 + Math.random() * 100000 },
      { year: 2020, month: 12, town, flat_type: '4 ROOM', price: 460000 + Math.random() * 100000 },
    ]),
    // 2021 data for all towns
    ...towns.flatMap(town => [
      { year: 2021, month: 1, town, flat_type: '4 ROOM', price: 470000 + Math.random() * 100000 },
      { year: 2021, month: 6, town, flat_type: '4 ROOM', price: 480000 + Math.random() * 100000 },
      { year: 2021, month: 12, town, flat_type: '4 ROOM', price: 490000 + Math.random() * 100000 },
    ]),
    // 2022 data for all towns
    ...towns.flatMap(town => [
      { year: 2022, month: 1, town, flat_type: '4 ROOM', price: 500000 + Math.random() * 100000 },
      { year: 2022, month: 6, town, flat_type: '4 ROOM', price: 510000 + Math.random() * 100000 },
      { year: 2022, month: 12, town, flat_type: '4 ROOM', price: 520000 + Math.random() * 100000 },
    ]),
    // 2023 data for all towns
    ...towns.flatMap(town => [
      { year: 2023, month: 1, town, flat_type: '4 ROOM', price: 530000 + Math.random() * 100000 },
      { year: 2023, month: 6, town, flat_type: '4 ROOM', price: 540000 + Math.random() * 100000 },
      { year: 2023, month: 12, town, flat_type: '4 ROOM', price: 550000 + Math.random() * 100000 },
    ]),
    // 2024 data for all towns
    ...towns.flatMap(town => [
      { year: 2024, month: 1, town, flat_type: '4 ROOM', price: 560000 + Math.random() * 100000 },
      { year: 2024, month: 2, town, flat_type: '4 ROOM', price: 570000 + Math.random() * 100000 },
      { year: 2024, month: 3, town, flat_type: '4 ROOM', price: 580000 + Math.random() * 100000 },
    ]),
  ];

  // useEffect to simulate data fetching when the component mounts.
  // In a real application, you could uncomment and use the axios request to fetch real data.
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Example API fetch (commented out for demonstration using static data)
        // const response = await axios.get('https://data.gov.sg/api/action/datastore_search', {
        //   params: { resource_id: 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc', limit: 5000 }
        // });
        // setPriceData(response.data.result.records);
        
        // Set static data for demonstration purposes
        setPriceData(staticData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Define market statistics to be displayed as summary cards.
  const marketStats = [
    {
      title: 'Average Price',
      value: 'S$890,000',
      change: '+4.2%',
      icon: <DollarSign className="h-6 w-6 text-blue-600" />,
    },
    {
      title: 'Properties Listed',
      value: '1,245',
      change: '+12.5%',
      icon: <Home className="h-6 w-6 text-blue-600" />,
    },
    {
      title: 'Popular Area',
      value: 'Tampines',
      change: 'High Demand',
      icon: <Map className="h-6 w-6 text-blue-600" />,
    },
    {
      title: 'Market Trend',
      value: 'Upward',
      change: 'Positive',
      icon: <TrendingUp className="h-6 w-6 text-blue-600" />,
    },
  ];

  // Process price data to generate data for a yearly trend chart.
  // The data is filtered by selectedYear (or all years if selectedYear === 'ALL'),
  // then grouped by a key that combines year and month, with average prices calculated.
  const yearlyTrendData = priceData
    .filter(data => selectedYear === 'ALL' || data.year.toString() === selectedYear)
    .reduce((acc: any[], curr) => {
      // Create a key based on year and month.
      const key = `${curr.year}-${curr.month}`;
      // Find existing data for the same key.
      const existingData = acc.find(item => item.key === key);
      // If found, average the prices; otherwise, push a new record.
      if (existingData) {
        existingData.price = (existingData.price + curr.price) / 2;
      } else {
        acc.push({
          key,
          year: curr.year,
          month: curr.month,
          price: curr.price,
        });
      }
      return acc;
    }, [])
    .sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);

  // Process price data for a town-by-town comparison.
  // For each selected town, calculate the average price across all records.
  const townComparisonData = selectedTowns.map(town => {
    // Filter data by town.
    const townData = priceData.filter(data => data.town === town);
    // Calculate average price.
    const avgPrice = townData.reduce((sum, curr) => sum + curr.price, 0) / (townData.length || 1);
    return { town, price: avgPrice };
  });

  // Function to toggle the selection of a town for comparison.
  // Limits the number of selectable towns to 5.
  const toggleTown = (town: string) => {
    setSelectedTowns(prev => {
      if (prev.includes(town)) {
        return prev.filter(t => t !== town);
      }
      return prev.length < 5 ? [...prev, town] : prev;
    });
  };

  // Render the Analytics component UI.
  return (
    <div className="pt-16 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Market Analytics</h1>

        {/* Market Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {marketStats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-blue-50 p-3 rounded-full">{stat.icon}</div>
                <span className={`text-sm font-medium ${stat.change.includes('+') ? 'text-green-600' : 'text-blue-600'}`}>
                  {stat.change}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{stat.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Interactive Graphs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Yearly Trend Graph */}
          <Card>
            <div className="flex justify-between items-center mb-6">
              <div>
                <Title>Property Price Trends</Title>
                <Text>Average property prices over time</Text>
              </div>
              {/* Dropdown to select year filter */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            {/* Responsive container for the LineChart */}
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="key"
                    tickFormatter={(value) => {
                      // Format the axis label as month/year (shortened year)
                      const [year, month] = value.split('-');
                      return `${month}/${year.slice(2)}`;
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => {
                      const [year, month] = value.split('-');
                      return `${month}/${year}`;
                    }}
                    formatter={(value: number) => [`S$${value.toLocaleString()}`, 'Price']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} name="Average Price" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Town Comparison Graph */}
          <Card>
            <div className="flex justify-between items-center mb-6">
              <div>
                <Title>Price Comparison by Town</Title>
                <Text>Average prices across different towns</Text>
              </div>
              {/* Button to toggle the town selection dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTownDropdown(!showTownDropdown)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                >
                  Select Towns ({selectedTowns.length})
                </button>
                {showTownDropdown && (
                  // Dropdown container for town selection
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-96 overflow-y-auto">
                    <div className="p-2">
                      {/* Display currently selected towns with option to remove */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedTowns.map(town => (
                          <span key={town} className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                            {town}
                            <button onClick={() => toggleTown(town)} className="ml-1 hover:text-blue-600">
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        ))}
                      </div>
                      {/* List all towns in the dropdown to allow adding new selections */}
                      <div className="border-t pt-2">
                        {towns.map(town => (
                          <button
                            key={town}
                            onClick={() => toggleTown(town)}
                            className={`block w-full text-left px-4 py-2 hover:bg-gray-100 rounded ${selectedTowns.includes(town) ? 'bg-blue-50' : ''}`}
                            disabled={selectedTowns.length >= 5 && !selectedTowns.includes(town)}
                          >
                            {town}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Responsive container for the BarChart */}
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={townComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="town" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`S$${value.toLocaleString()}`, 'Price']} />
                  <Legend />
                  <Bar dataKey="price" fill="#3b82f6" name="Average Price" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Market Insights Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Market Insights</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mt-2"></span>
                </div>
                <p className="ml-3 text-gray-600">
                  Property prices in Tampines have shown a steady increase of 4.2% over the past quarter
                </p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mt-2"></span>
                </div>
                <p className="ml-3 text-gray-600">
                  HDB resale volumes increased by 12.5% compared to the previous month
                </p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mt-2"></span>
                </div>
                <p className="ml-3 text-gray-600">
                  New launches in the eastern region are seeing strong buyer interest
                </p>
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Price Predictions</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">HDB Prices</span>
                  <span className="text-green-600">+2.5%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Condo Prices</span>
                  <span className="text-blue-600">+3.8%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-600">Landed Property</span>
                  <span className="text-purple-600">+1.2%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the Analytics component as the default export.
export default Analytics;
