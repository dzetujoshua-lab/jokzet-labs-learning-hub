import type { Metadata } from "next";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { requireUser } from "@/lib/auth/dal";
import { ensureLearnerSetup, listDepartments } from "@/lib/missions/service";
import { listCoverChoices, listPortfolio, listSkills, listSuggestions } from "@/lib/portfolio/service";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await requireUser();
  await ensureLearnerSetup(user.id);
  const [{ pieces, capstone }, suggestions, skills, covers, departments] = await Promise.all([
    listPortfolio(user.id),
    listSuggestions(user.id),
    listSkills(user.id),
    listCoverChoices(user.id),
    listDepartments(user.id),
  ]);
  return (
    <PortfolioView
      pieces={pieces}
      capstone={capstone}
      suggestions={suggestions}
      skills={skills}
      covers={covers}
      departments={departments.map((d) => ({ code: d.code, name: d.name }))}
    />
  );
}
