"""
AgentController — Google ADK-powered ReAct agent.

Uses the existing NLPController.search_vector_db_collection() and the generation
client's genrate_text() as ADK tools, wired via closure so the ADK tool functions
remain plain callables with no request-context arguments.

All prompts are imported from Stores/LLM/Templates/Locales/en/agent.py via
template_parser — zero prompt strings live in this file.
"""
import logging
import asyncio
from typing import Optional

from .BaseController import basecontroller
from .NLPController import NLPController
from Utils.language_detect import detect_query_language
from Utils.PromptGuard import PromptGuard
from Helpers.Config import get_settings

logger = logging.getLogger(__name__)


class AgentController(basecontroller):
    """
    Orchestrates multi-step research using Google ADK.

    Tool functions are built as closures at run time so they capture
    `nlp_controller` and `project` without needing extra parameters —
    which is the standard ADK pattern for request-scoped context.
    """

    def __init__(self, generation_client, embedding_client, vectordb_client, template_parser):
        super().__init__()
        self.generation_client = generation_client
        self.embedding_client  = embedding_client
        self.vectordb_client   = vectordb_client
        self.template_parser   = template_parser
        self.settings          = get_settings()

    # ── Tool Factory ───────────────────────────────────────────────────────────
    def _build_tools(self, nlp_controller: NLPController, project):
        """
        Return a list of async ADK-compatible tool functions, each capturing
        the request-scoped nlp_controller and project via closure.
        This adapts the existing NLPController methods directly as ADK tools.
        """
        settings = self.settings
        template_parser = self.template_parser
        generation_client = self.generation_client

        async def search_rag(query: str, limit: int = 5) -> str:
            """
            Search the RAG vector index for document chunks relevant to the query.
            Returns the most relevant text chunks found in the indexed documents.

            Args:
                query: The search query string to find relevant information.
                limit: Maximum number of results to return (default 5).
            """
            try:
                effective_limit = limit or settings.AGENT_DEFAULT_SEARCH_LIMIT
                results = await nlp_controller.search_vector_db_collection(
                    project=project,
                    text=query,
                    limit=effective_limit,
                )
                if not results:
                    return "No results found in the index for this query. The information may not be in the indexed documents."
                chunks = []
                for i, r in enumerate(results):
                    chunk = f"[Chunk {i+1}]\n{r.text}"
                    if getattr(r, "metadata", None) and isinstance(r.metadata, dict):
                        src = r.metadata.get("source", "")
                        if src:
                            chunk = f"[Chunk {i+1} | Source: {src}]\n{r.text}"
                    chunks.append(chunk)
                return "\n\n---\n\n".join(chunks)
            except Exception as e:
                logger.error("search_rag tool error: %s", e)
                return f"Search encountered an error: {str(e)}"

        async def summarize(text: str, focus: str = "general") -> str:
            """
            Summarize a long text into key points, optionally focused on a topic.
            Use this when retrieved chunks are very long and need to be condensed.

            Args:
                text: The text content to summarize.
                focus: Optional focus area or topic for the summary (default 'general').
            """
            try:
                prompt = template_parser.get(
                    "agent", "summarize_internal_prompt",
                    {"text": text[:8000], "focus": focus or "general"}
                )
                result = generation_client.genrate_text(
                    prompt=prompt,
                    temperature=0.1,
                    max_prompt_characters=10_000,
                )
                return result or "Summarization could not be completed."
            except Exception as e:
                logger.error("summarize tool error: %s", e)
                return f"Summarization encountered an error: {str(e)}"

        return [search_rag, summarize]

    # ── Main Entry Point ───────────────────────────────────────────────────────
    async def run_agent(
        self,
        goal: str,
        project,
        nlp_controller: NLPController,
        max_steps: Optional[int] = None,
        chat_history: Optional[list] = None,
    ) -> dict:
        """
        Run the ADK agent to answer `goal` using RAG tools.

        Returns:
            {
                "answer": str,
                "steps":  list[dict],   # tool calls and their results
                "sources": list[str],
            }
        """
        settings   = get_settings()
        max_steps  = max_steps or settings.AGENT_MAX_STEPS
        chat_history = chat_history or []

        # ── Input guard ───────────────────────────────────────────────────────
        safe, reason = PromptGuard.validate_input(goal)
        if not safe:
            logger.warning("AgentController: input blocked — %s", reason)
            return {
                "answer": "I can only help with questions about the provided documents.",
                "steps": [],
                "sources": [],
            }

        response_language = detect_query_language(goal)

        # ── Build system prompt from template ─────────────────────────────────
        system_prompt_text = self.template_parser.get(
            "agent", "system_prompt",
            {"response_language": response_language}
        )

        # ── Build ADK tools from existing NLPController methods ───────────────
        tools = self._build_tools(nlp_controller, project)

        # ── Import ADK components ─────────────────────────────────────────────
        try:
            from google.adk.agents import Agent
            from google.adk.runners import Runner
            from google.adk.sessions import InMemorySessionService
            from google.genai import types as genai_types
        except ImportError as e:
            logger.error("google-adk not installed: %s", e)
            return {
                "answer": "Agent system is not available (google-adk missing).",
                "steps": [],
                "sources": [],
            }

        # ── Build the ADK Agent ───────────────────────────────────────────────
        import os
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
        if getattr(settings, "OPENAI_API_KEY", None):
            os.environ["OPENAI_API_KEY"] = settings.OPENAI_API_KEY
        if getattr(settings, "OPENAI_BASE_URL", None):
            os.environ["OPENAI_BASE_URL"] = settings.OPENAI_BASE_URL
        if getattr(settings, "HUGGINGFACE_API_KEY", None):
            os.environ["HUGGINGFACE_API_KEY"] = settings.HUGGINGFACE_API_KEY
        if getattr(settings, "COHERE_API_KEY", None):
            os.environ["COHERE_API_KEY"] = settings.COHERE_API_KEY

        # ADK native resolves Google models. For other providers, we use litellm prefixes.
        backend = settings.GENRATION_BACKEND.upper()
        model_id = settings.GENRATION_MODEL_ID

        if backend == "GEMINI":
            if model_id.startswith("models/"):
                model_id = model_id[len("models/"):]
        elif backend == "OPENAI":
            if not model_id.startswith("openai/"):
                model_id = f"openai/{model_id}"
        elif backend == "HUGGINGFACE":
            if not model_id.startswith("huggingface/"):
                model_id = f"huggingface/{model_id}"
        elif backend == "COHERE":
            if not model_id.startswith("cohere/"):
                model_id = f"cohere/{model_id}"

        agent = Agent(
            model=model_id,
            name="fehres_research_agent",
            description="A research agent that searches indexed documents to answer questions.",
            instruction=system_prompt_text,
            tools=tools,
        )

        # ── Set up session ────────────────────────────────────────────────────
        session_service = InMemorySessionService()
        runner = Runner(
            agent=agent,
            app_name="fehres",
            session_service=session_service,
        )

        user_id   = "agent_user"
        session_id = "agent_session"
        await session_service.create_session(
            app_name="fehres",
            user_id=user_id,
            session_id=session_id,
        )

        # ── Build the user message (include chat context if available) ─────────
        if chat_history:
            context_lines = []
            for m in chat_history[-6:]:  # last 3 turns for context
                role    = (m.get("role") or "").lower()
                content = (m.get("content") or "").strip()
                if content and role in ("user", "assistant"):
                    context_lines.append(f"{role.capitalize()}: {content}")
            if context_lines:
                goal = "Previous conversation:\n" + "\n".join(context_lines) + f"\n\nCurrent goal: {goal}"

        user_message = genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=goal)],
        )

        # ── Run the ADK agent loop, collect steps ─────────────────────────────
        steps: list[dict] = []
        final_answer = ""
        sources: list[str] = []
        step_num = 0

        logger.info("AgentController: starting ADK run for goal=%r", goal[:80])
        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=user_message,
            ):
                # Collect tool calls as steps
                if hasattr(event, "content") and event.content:
                    for part in (event.content.parts or []):
                        # Tool call (agent → tool)
                        if hasattr(part, "function_call") and part.function_call:
                            step_num += 1
                            fc = part.function_call
                            steps.append({
                                "step": step_num,
                                "tool": fc.name,
                                "args": dict(fc.args or {}),
                                "result": "(pending)",
                            })
                            logger.info(
                                "Agent step %d: tool=%s args=%s",
                                step_num, fc.name, dict(fc.args or {})
                            )

                        # Tool response (tool → agent)
                        if hasattr(part, "function_response") and part.function_response:
                            fr = part.function_response
                            result_text = str(fr.response or "")
                            # Match back to the last pending step with this tool name
                            for s in reversed(steps):
                                if s["tool"] == fr.name and s["result"] == "(pending)":
                                    s["result"] = result_text[:2000]
                                    break

                # Final response
                if event.is_final_response():
                    if event.content and event.content.parts:
                        final_answer = "".join(
                            part.text for part in event.content.parts
                            if hasattr(part, "text") and part.text
                        )
                    break

                # Hard cap on steps
                if step_num >= max_steps:
                    logger.warning("AgentController: max_steps=%d reached, stopping", max_steps)
                    break

        except Exception as e:
            logger.error("AgentController ADK run error: %s", e, exc_info=True)
            # Fallback: try to answer directly with RAG
            return await self._fallback_answer(
                goal=goal,
                nlp_controller=nlp_controller,
                project=project,
                response_language=response_language,
                steps=steps,
            )

        # ── If no final answer was captured, generate one from steps ──────────
        if not final_answer and steps:
            research_text = "\n\n".join(
                s["result"] for s in steps
                if s.get("result") and s["result"] != "(pending)"
            )
            final_answer = await self._synthesize_answer(
                goal=goal,
                research_summary=research_text,
                response_language=response_language,
            )

        if not final_answer:
            return await self._fallback_answer(
                goal=goal,
                nlp_controller=nlp_controller,
                project=project,
                response_language=response_language,
                steps=steps,
            )

        # ── Output guard ──────────────────────────────────────────────────────
        out_safe, out_reason = PromptGuard.validate_output(final_answer)
        if not out_safe:
            logger.warning("AgentController: output blocked — %s", out_reason)
            return {
                "answer": "I can only help with questions about the provided documents.",
                "steps": steps,
                "sources": [],
            }

        # ── Extract sources from step results ─────────────────────────────────
        for step in steps:
            if step.get("tool") == "search_rag":
                result_str = step.get("result", "")
                for line in result_str.split("\n"):
                    if "Source:" in line:
                        src_part = line.split("Source:")[-1].strip().rstrip("]")
                        if src_part and src_part not in sources:
                            sources.append(src_part)

        logger.info("AgentController: completed — %d steps, %d sources", len(steps), len(sources))
        return {
            "answer": final_answer.strip(),
            "steps": steps,
            "sources": sources,
        }

    # ── Helpers ────────────────────────────────────────────────────────────────
    async def _synthesize_answer(
        self,
        goal: str,
        research_summary: str,
        response_language: str,
    ) -> str:
        """Generate a final answer from accumulated research using the generation client."""
        try:
            prompt = self.template_parser.get(
                "agent", "final_answer_format_prompt",
                {
                    "response_language": response_language,
                    "research_summary": research_summary[:6000],
                }
            )
            answer = self.generation_client.genrate_text(
                prompt=f"Goal: {goal}\n\n{prompt}",
                temperature=self.settings.AGENT_TEMPERATURE,
                max_prompt_characters=self.settings.AGENT_MAX_PROMPT_CHARS,
            )
            return answer or ""
        except Exception as e:
            logger.error("AgentController: synthesis error: %s", e)
            return ""

    async def _fallback_answer(
        self,
        goal: str,
        nlp_controller: NLPController,
        project,
        response_language: str,
        steps: list,
    ) -> dict:
        """
        Last-resort fallback: run a direct RAG query using NLPController
        if ADK fails or produces no answer.
        """
        logger.info("AgentController: using RAG fallback for goal=%r", goal[:60])
        try:
            answer, _, _ = await nlp_controller.answer_rag_question(
                project=project,
                query=goal,
                limit=self.settings.AGENT_DEFAULT_SEARCH_LIMIT,
            )
        except Exception as e:
            logger.error("AgentController fallback RAG error: %s", e)
            answer = None

        return {
            "answer": answer or "I was unable to find relevant information in the indexed documents.",
            "steps": steps,
            "sources": [],
        }
