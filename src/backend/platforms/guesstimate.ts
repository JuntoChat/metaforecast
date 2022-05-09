import axios from "axios";
import { parseISO } from "date-fns";

/* Imports */
import { Question } from "@prisma/client";

import { AlgoliaQuestion } from "../../backend/utils/algolia";
import { prisma } from "../database/prisma";
import { Platform } from "./";

/* Definitions */
const searchEndpoint =
  "https://m629r9ugsg-dsn.algolia.net/1/indexes/Space_production/query?x-algolia-agent=Algolia%20for%20vanilla%20JavaScript%203.32.1&x-algolia-application-id=M629R9UGSG&x-algolia-api-key=4e893740a2bd467a96c8bfcf95b2809c";

const apiEndpoint = "https://guesstimate.herokuapp.com";

/* Body */

const modelToQuestion = (model: any): Question => {
  const { description } = model;
  // const description = model.description
  //   ? model.description.replace(/\n/g, " ").replace(/  /g, " ")
  //   : "";
  const stars = description.length > 250 ? 2 : 1;
  const timestamp = parseISO(model.created_at);
  const q: Question = {
    id: `guesstimate-${model.id}`,
    title: model.name,
    url: `https://www.getguesstimate.com/models/${model.id}`,
    timestamp,
    platform: "guesstimate",
    description,
    options: [],
    qualityindicators: {
      stars,
      numforecasts: 1,
      numforecasters: 1,
    },
    extra: {
      visualization: model.big_screenshot,
    },
    // ranking: 10 * (index + 1) - 0.5, //(model._rankingInfo - 1*index)// hack
  };
  return q;
};

async function search(query: string): Promise<AlgoliaQuestion[]> {
  const response = await axios({
    url: searchEndpoint,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: `{\"params\":\"query=${query.replace(
      / /g,
      "%20"
    )}&hitsPerPage=20&page=0&getRankingInfo=true\"}`,
    method: "POST",
  });

  const models: any[] = response.data.hits;
  const mappedModels: AlgoliaQuestion[] = models.map((model) => {
    const q = modelToQuestion(model);
    return {
      ...q,
      timestamp: String(q.timestamp),
    };
  });

  // filter for duplicates. Surprisingly common.
  let uniqueTitles = [];
  let uniqueModels: AlgoliaQuestion[] = [];
  for (let model of mappedModels) {
    if (!uniqueTitles.includes(model.title) && !model.title.includes("copy")) {
      uniqueModels.push(model);
      uniqueTitles.push(model.title);
    }
  }

  return uniqueModels;
}

const fetchQuestion = async (id: number): Promise<Question> => {
  const response = await axios({ url: `${apiEndpoint}/spaces/${id}` });
  let q = modelToQuestion(response.data);
  q = await prisma.question.upsert({
    where: { id: q.id },
    create: q,
    update: q,
  });
  return q;
};

export const guesstimate: Platform & {
  search: typeof search;
  fetchQuestion: typeof fetchQuestion;
} = {
  name: "guesstimate",
  label: "Guesstimate",
  color: "#223900",
  search,
  fetchQuestion,
};
