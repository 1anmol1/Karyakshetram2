// Pune & Pimpri-Chinchwad pilot geography (PRD scope). Rough city polygon, [lat, lon].
export const CITY = {
  key: 'pune',
  name: 'Pune & PCMC',
  center: [18.555, 73.85],
  polygon: [
    [18.445, 73.76], [18.44, 73.86], [18.45, 73.93], [18.49, 73.99], [18.56, 73.995], [18.62, 73.94],
    [18.69, 73.88], [18.695, 73.79], [18.67, 73.735], [18.6, 73.715], [18.52, 73.725], [18.47, 73.74],
  ],
  comingSoon: ['Kolhapur', 'Nashik', 'Nagpur'],
};

export const LOCALITIES = [
  ['Baner', 18.559, 73.7868], ['Balewadi', 18.5765, 73.769], ['Aundh', 18.559, 73.8077], ['Wakad', 18.5986, 73.7646],
  ['Hinjewadi', 18.5913, 73.7389], ['Kothrud', 18.5074, 73.8077], ['Viman Nagar', 18.5679, 73.9143], ['Kharadi', 18.5515, 73.9348],
  ['Koregaon Park', 18.5362, 73.894], ['Hadapsar', 18.5089, 73.926], ['Pimple Saudagar', 18.5994, 73.7997], ['Shivajinagar', 18.5308, 73.8475],
  ['Magarpatta', 18.5146, 73.9294], ['Bavdhan', 18.5104, 73.7709], ['Pashan', 18.5362, 73.7997], ['Pimpri', 18.6298, 73.7997],
  ['Chinchwad', 18.644, 73.7925], ['Nigdi', 18.651, 73.77], ['Bhosari', 18.62, 73.85], ['Yerawada', 18.5523, 73.886],
  ['Kalyani Nagar', 18.5463, 73.9033], ['Wanowrie', 18.49, 73.899], ['Kondhwa', 18.4677, 73.889], ['Katraj', 18.4529, 73.856],
  ['Sinhagad Road', 18.48, 73.82], ['Warje', 18.484, 73.8], ['Camp', 18.515, 73.878], ['Deccan', 18.5167, 73.841],
  ['Swargate', 18.5018, 73.8636], ['Dhanori', 18.594, 73.903], ['Wagholi', 18.58, 73.975], ['Undri', 18.456, 73.91],
  ['Sus', 18.542, 73.77], ['Mahalunge', 18.576, 73.75], ['Ravet', 18.646, 73.748], ['Moshi', 18.67, 73.85],
  ['Dighi', 18.62, 73.88], ['Pimple Nilakh', 18.575, 73.79], ['Sangvi', 18.58, 73.815], ['Akurdi', 18.648, 73.766],
].map(([name, lat, lon]) => ({ name, lat, lon }));

// zones used to synthesise land use (simulated, documented in Trust Center)
export const ZONES = {
  industrial: [[18.62, 73.85, 3.2], [18.5, 73.95, 2.2], [18.66, 73.82, 2.5]],
  green: [[18.535, 73.785, 1.8], [18.455, 73.85, 2.2], [18.505, 73.79, 1.2]],
  core: [[18.52, 73.856, 5], [18.627, 73.8, 4], [18.555, 73.905, 3]],
  growth: [[18.595, 73.75, 4], [18.555, 73.94, 3], [18.58, 73.97, 3]],
};
