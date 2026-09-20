/**
 * Physical RF Environmental Profiles
 */

export const ENVIRONMENTS = {
  'Open Outdoor': {
    name: 'Open Outdoor',
    description: 'Line-of-Sight free-space propagation with minimal multipath.',
    ple: 2.0,
    rssiNoiseStd: 1.2,
    multipathStd: 0.5,
    packetLossProb: 0.01,
    color: '#34d399'
  },
  'Semi-Outdoor': {
    name: 'Semi-Outdoor',
    description: 'Campus grounds with light vegetation and building corners.',
    ple: 2.4,
    rssiNoiseStd: 2.2,
    multipathStd: 1.2,
    packetLossProb: 0.04,
    color: '#38bdf8'
  },
  'Indoor': {
    name: 'Indoor',
    description: 'Office environment with drywall, furniture, and partition attenuation.',
    ple: 2.85,
    rssiNoiseStd: 3.5,
    multipathStd: 2.0,
    packetLossProb: 0.08,
    color: '#a78bfa'
  },
  'High Multipath': {
    name: 'High Multipath',
    description: 'Industrial warehouse with metal shelving and dense reflections.',
    ple: 3.3,
    rssiNoiseStd: 5.2,
    multipathStd: 3.8,
    packetLossProb: 0.15,
    color: '#fbbf24'
  },
  'Obstructed': {
    name: 'Obstructed',
    description: 'Severe Non-Line-of-Sight (NLOS) blockage with reinforced concrete.',
    ple: 4.0,
    rssiNoiseStd: 7.0,
    multipathStd: 4.5,
    packetLossProb: 0.28,
    color: '#f43f5e'
  }
};