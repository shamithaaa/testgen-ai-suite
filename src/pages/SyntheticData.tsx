import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Thermometer, Gauge, MapPin, Fuel, Loader2, RefreshCw } from "lucide-react";
import { useSyntheticData, useGenerateSyntheticData } from "@/hooks/use-synthetic-data";
import { mockSyntheticData } from "@/lib/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const statusColors: Record<string, string> = {
  Active: "bg-success/15 text-success border-success/20",
  Idle: "bg-warning/15 text-warning border-warning/20",
  Maintenance: "bg-destructive/15 text-destructive border-destructive/20",
};

const SyntheticData = () => {
  const [scenario, setScenario] = useState("");
  const { data, isLoading, isError } = useSyntheticData(50);
  const generateMutation = useGenerateSyntheticData();

  const displayData = data ?? (isError ? mockSyntheticData.map((d) => ({
    id: d.vehicleId,
    vehicle_id: d.vehicleId,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lng),
    engine_temp: d.engineTemp,
    rpm: d.rpm,
    fuel_level: d.fuelLevel,
    oil_pressure: d.oilPressure,
    speed: d.speed,
    trip_id: d.tripId,
    status: d.status as "Active" | "Idle" | "Maintenance",
    timestamp: d.timestamp,
  })) : []);

  const avgTemp = displayData.length ? Math.round(displayData.reduce((s, d) => s + d.engine_temp, 0) / displayData.length) : 0;
  const avgRpm = displayData.length ? Math.round(displayData.reduce((s, d) => s + d.rpm, 0) / displayData.length) : 0;
  const avgFuel = displayData.length ? Math.round(displayData.reduce((s, d) => s + d.fuel_level, 0) / displayData.length) : 0;
  const activeCount = displayData.filter((d) => d.status === "Active").length;

  const chartData = displayData.slice(0, 12).map((d) => ({
    name: d.vehicle_id.slice(-4),
    temp: d.engine_temp,
    rpm: d.rpm,
    speed: d.speed,
    fuel: d.fuel_level,
  }));

  const stats = [
    { label: "Avg Engine Temp", value: `${avgTemp}°F`, icon: Thermometer, color: "text-destructive" },
    { label: "Avg RPM", value: avgRpm.toLocaleString(), icon: Gauge, color: "text-primary" },
    { label: "Avg Fuel Level", value: `${avgFuel}%`, icon: Fuel, color: "text-warning" },
    { label: "Active Vehicles", value: activeCount, icon: MapPin, color: "text-success" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Synthetic Test Data</h1>
            <p className="text-muted-foreground">
              {isError ? "Showing cached mock data — backend unreachable" : "AI-generated vehicle telemetry data for testing"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="text-xs font-mono bg-muted/30 border border-border/50 rounded-lg px-3 py-2 w-48 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              placeholder="Scenario (optional)…"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            />
            <Button
              onClick={() => generateMutation.mutate({ count: 20, scenario: scenario || undefined })}
              disabled={generateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-display glow-primary"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Generate Data</>
              )}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="stat-card"
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
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
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
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))", fontSize: 12 }} />
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
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs ml-2">
              {displayData.length} records
            </Badge>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-2" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30">
                  {["Vehicle", "GPS", "Temp", "RPM", "Fuel", "Speed", "Oil PSI", "Trip", "Status", "Timestamp"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-display font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map((d, i) => (
                  <motion.tr
                    key={d.vehicle_id + i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-medium text-primary">{d.vehicle_id}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{d.lat.toFixed(4)}, {d.lng.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <span className={d.engine_temp > 220 ? "text-destructive" : "text-foreground"}>{d.engine_temp.toFixed(1)}°F</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{d.rpm}</td>
                    <td className="px-4 py-3">{d.fuel_level.toFixed(1)}%</td>
                    <td className="px-4 py-3">{d.speed.toFixed(1)} mph</td>
                    <td className="px-4 py-3">{d.oil_pressure.toFixed(1)} PSI</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{d.trip_id}</td>
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
