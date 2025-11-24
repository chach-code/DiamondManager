import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroImage from "@assets/generated_images/baseball_stadium_hero_image.png";
import { Users, Target, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[500px] overflow-hidden">
        <img
          src={heroImage}
          alt="Baseball stadium"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-4">
          <h1 className="font-bebas text-6xl tracking-wider mb-4">
            Baseball Team Manager
          </h1>
          <p className="text-xl mb-8 max-w-2xl text-white/90">
            Create teams, manage rosters, and generate winning lineups instantly
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-signin"
          >
            Sign In with Google
          </Button>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bebas text-2xl tracking-wide mb-2">Manage Teams</h3>
            <p className="text-muted-foreground">
              Create and organize multiple teams with full roster management
            </p>
          </Card>

          <Card className="p-6">
            <Target className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bebas text-2xl tracking-wide mb-2">Batting Orders</h3>
            <p className="text-muted-foreground">
              Generate random batting lineups and see player positions at a glance
            </p>
          </Card>

          <Card className="p-6">
            <Zap className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bebas text-2xl tracking-wide mb-2">Field Positions</h3>
            <p className="text-muted-foreground">
              Assign players to field positions with visual baseball diamond
            </p>
          </Card>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-muted py-16">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="font-bebas text-4xl tracking-wide mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            Sign in with your Google account to start managing your teams today
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-signin-cta"
          >
            Sign In Now
          </Button>
        </div>
      </div>
    </div>
  );
}
