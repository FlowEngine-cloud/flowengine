/**
 * Multi-Agent Orchestrator - Usage Examples
 *
 * This file demonstrates how to create multi-agent workflows using the orchestrator.
 * These are NOT test files (no test framework), just usage examples.
 */

import { createMultiAgentWorkflow, type MultiAgentWorkflowConfig } from './multiAgentOrchestrator';
import { validateAIAgentWorkflow } from './aiAgentValidator';

/**
 * Example 1: Sequential Pipeline - Research → Write → Edit
 */
export function createContentPipeline() {
  const config: MultiAgentWorkflowConfig = {
    name: 'Content Creation Pipeline',
    description: 'Research a topic, write content, and edit for quality',
    pattern: 'sequential',
    agents: [
      {
        name: 'Research Agent',
        role: 'processor',
        systemMessage: 'You are a research specialist. Gather comprehensive information on topics, verify facts, and compile detailed research findings.',
        model: 'openai',
        tools: ['http', 'code'],
      },
      {
        name: 'Writer Agent',
        role: 'processor',
        systemMessage: 'You are a professional writer. Transform research into engaging, well-structured content with clear narratives and compelling language.',
        model: 'openai',
        tools: ['code'],
      },
      {
        name: 'Editor Agent',
        role: 'processor',
        systemMessage: 'You are an editor. Review content for clarity, grammar, structure, and style. Provide polished final versions.',
        model: 'openai',
        tools: ['code'],
      },
    ],
  };

  const workflow = createMultiAgentWorkflow(config);

  // Validate the generated workflow
  const validation = validateAIAgentWorkflow(workflow, { autofix: true });

  console.log('Sequential Pipeline Workflow:');
  console.log('- Nodes:', workflow.nodes.length);
  console.log('- Valid:', validation.isValid);
  console.log('- Errors:', validation.errors);
  console.log('- Warnings:', validation.warnings);

  return validation.isValid ? (validation.workflow || workflow) : workflow;
}

/**
 * Example 2: Parallel Processing - Multi-perspective Code Review
 */
export function createCodeReviewWorkflow() {
  const config: MultiAgentWorkflowConfig = {
    name: 'Parallel Code Review',
    description: 'Review code from security, performance, and style perspectives',
    pattern: 'parallel',
    agents: [
      {
        name: 'Security Reviewer',
        role: 'specialist',
        systemMessage: 'You are a security expert. Review code for vulnerabilities, injection risks, authentication issues, and security best practices.',
        model: 'openai',
        tools: ['code'],
      },
      {
        name: 'Performance Reviewer',
        role: 'specialist',
        systemMessage: 'You are a performance optimization expert. Analyze code for efficiency, bottlenecks, memory usage, and scalability.',
        model: 'openai',
        tools: ['code'],
      },
      {
        name: 'Style Reviewer',
        role: 'specialist',
        systemMessage: 'You are a code style expert. Review code for readability, naming conventions, documentation, and adherence to best practices.',
        model: 'openai',
        tools: ['code'],
      },
    ],
  };

  const workflow = createMultiAgentWorkflow(config);

  // Validate the generated workflow
  const validation = validateAIAgentWorkflow(workflow, { autofix: true });

  console.log('Parallel Code Review Workflow:');
  console.log('- Nodes:', workflow.nodes.length);
  console.log('- Valid:', validation.isValid);
  console.log('- Errors:', validation.errors);
  console.log('- Warnings:', validation.warnings);

  return validation.isValid ? (validation.workflow || workflow) : workflow;
}

/**
 * Example 3: Hierarchical - Business Support System
 */
export function createSupportWorkflow() {
  const config: MultiAgentWorkflowConfig = {
    name: 'Business Support System',
    description: 'Coordinator delegates to email and data specialists',
    pattern: 'hierarchical',
    agents: [
      {
        name: 'Support Coordinator',
        role: 'coordinator',
        systemMessage: 'You coordinate customer support requests. Analyze requests and delegate to appropriate specialists: email specialist for communications, data specialist for analysis.',
        model: 'openai',
        tools: ['code', 'http'],
        delegatesTo: ['Email Specialist', 'Data Specialist'],
      },
      {
        name: 'Email Specialist',
        role: 'specialist',
        systemMessage: 'You handle all email-related tasks. Draft professional emails, manage communications, and ensure proper email etiquette.',
        model: 'openai',
        tools: ['http', 'code'],
      },
      {
        name: 'Data Specialist',
        role: 'specialist',
        systemMessage: 'You handle data analysis and reporting. Process data, generate insights, and create comprehensive reports.',
        model: 'openai',
        tools: ['code', 'calculator'],
      },
    ],
  };

  const workflow = createMultiAgentWorkflow(config);

  // Validate the generated workflow
  const validation = validateAIAgentWorkflow(workflow, { autofix: true });

  console.log('Hierarchical Support Workflow:');
  console.log('- Nodes:', workflow.nodes.length);
  console.log('- Valid:', validation.isValid);
  console.log('- Errors:', validation.errors);
  console.log('- Warnings:', validation.warnings);

  return validation.isValid ? (validation.workflow || workflow) : workflow;
}

/**
 * Run all examples
 */
export function runAllExamples() {
  console.log('=== Multi-Agent Orchestrator Examples ===\n');

  console.log('1. Sequential Pipeline:');
  createContentPipeline();

  console.log('\n2. Parallel Processing:');
  createCodeReviewWorkflow();

  console.log('\n3. Hierarchical Delegation:');
  createSupportWorkflow();

  console.log('\n=== All examples completed ===');
}

// Uncomment to run examples:
// runAllExamples();
