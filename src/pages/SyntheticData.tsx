import { motion } from "framer-motion";
import { Database, Thermometer, Gauge, MapPin, Fuel } from "lucide-react";
import { mockSyntheticData } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const chartData = mockSyntheticData.slice(0, 12).map((d, i) => ({
  name: d.vehicleId.slice(-4),
  temp: d.engineTemp,
  rpm: d.rpm,
  speed: d.speed,
  fuel: d.fuelLevel,
}));

const statusColors: Record<string, string> = {
  Active: "bg-success/15 text-success border-success/20",
  Idle: "bg-warning/15 text-warning border-warning/20",
  Maintenance: "bg-destructive/15 text-destructive border-destructive/20",
};

const SyntheticData = () => {
  const avgTemp = Math.round(mockSyntheticData.reduce((s, d) => s + d.engineTemp, 0) / mockSyntheticData.length);
  const avgRpm = Math.round(mockSyntheticData.reduce((s, d) => s + d.rpm, 0) / mockSyntheticData.length);
  const avgFuel = Math.round(mockSyntheticData.reduce((s, d) => s + d.fuelLevel, 0) / mockSyntheticData.length);
  const activeCount = mockSyntheticData.filter((d) => d.status === "Active").length;

  const stats = [
    { label: "Avg Engine Temp", value: `${avgTemp}°F`, icon: Thermometer, color: "text-destructive" },
    { label: "Avg RPM", value: avgRpm.toLocaleString(), icon: Gauge, color: "text-primary" },
    { label: "Avg Fuel Level", value: `${avgFuel}%`, icon: Fuel, color: "text-warning" },
    { label: "Active Vehicles", value: activeCount, icon: MapPin, color: "text-success" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Synthetic Test Data</h1>
          <p className="text-muted-foreground">AI-generated vehicle telemetry data for testing</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="floating-card p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <span className="text-2xl font-display font-bold">{s.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-4 mb-6">
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-primary" /> Engine Temperature
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(174, 80%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(174, 80%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 12%, 16%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(225, 15%, 10%)", border: "1px solid hsl(225, 12%, 16%)", borderRadius: 8, color: "hsl(210, 20%, 92%)", fontSize: 12 }} />
                <Area type="monotone" dataKey="temp" stroke="hsl(174, 80%, 50%)" fill="url(#tempGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="floating-card p-5">
            <h3 className="font-display font-semibold text-sm mb-4 flex items-center gap-2">
              <Gauge className="h-4 w-4 text-secondary" /> RPM Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 12%, 16%)" />
                <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(225, 15%, 10%)", border: "1px solid hsl(225, 12%, 16%)", borderRadius: 8, color: "hsl(210, 20%, 92%)", fontSize: 12 }} />
                <Bar dataKey="rpm" fill="hsl(260, 60%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Table */}
        <div className="floating-card overflow-hidden">
          <div className="p-4 border-b border-border/30 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">Vehicle Telemetry Table</span>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs ml-2">{mockSyntheticData.length} records</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {["Vehicle", "GPS", "Temp", "RPM", "Fuel", "Speed", "Oil PSI", "Trip", "Status", "Timestamp"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-display font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockSyntheticData.map((d, i) => (
                  <motion.tr
                    key={d.vehicleId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/20 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">{d.vehicleId}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{d.lat}, {d.lng}</td>
                    <td className="px-4 py-3">
                      <span className={d.engineTemp > 220 ? "text-destructive" : "text-foreground"}>{d.engineTemp}°F</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{d.rpm}</td>
                    <td className="px-4 py-3">{d.fuelLevel}%</td>
                    <td className="px-4 py-3">{d.speed} mph</td>
                    <td className="px-4 py-3">{d.oilPressure} PSI</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{d.tripId}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[d.status]}`}>{d.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(d.timestamp).toLocaleTimeString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SyntheticData;
