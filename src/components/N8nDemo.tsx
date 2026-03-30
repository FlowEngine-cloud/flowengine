'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

interface N8nDemoProps {
  workflow: object | null;
  showFrame?: boolean;
  isDragging?: boolean;
}

/**
 * Wrapper component that loads the n8n-demo web component
 * Uses the component from: https://n8n-io.github.io/n8n-demo-webcomponent/
 */
export default function N8nDemo({
  workflow,
  showFrame = false,
  isDragging = false,
}: N8nDemoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [componentReady, setComponentReady] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoElementRef = useRef<HTMLElement | null>(null);
  const workflowRef = useRef<string | null>(null);
  const loadingStarted = useRef<boolean>(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Debug workflow prop
  useEffect(() => {
    console.log('🎯 N8nDemo received workflow:', {
      hasWorkflow: !!workflow,
      nodes: (workflow as any)?.nodes?.length || 0,
      workflowKeys: workflow ? Object.keys(workflow) : [],
    });
  }, [workflow]);

  // Load the n8n demo web component
  useEffect(() => {
    if (typeof window === 'undefined' || scriptsLoaded || loadingStarted.current) return;

    console.log('N8nDemo: Loading n8n demo web component...');
    loadingStarted.current = true;

    // Check if scripts are already loaded globally
    if (customElements.get('n8n-demo')) {
      console.log('N8nDemo: Component already registered globally');
      setScriptsLoaded(true);
      setComponentReady(true);
      return;
    }

    // Load scripts in sequence
    const loadScript = (src: string, type?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if script is already loaded
        const existingScript = document.querySelector(`script[src="${src}"]`);
        if (existingScript) {
          console.log('N8nDemo: Script already loaded:', src);
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        if (type) script.type = type;
        script.onload = () => {
          console.log('N8nDemo: Loaded script:', src);
          resolve();
        };
        script.onerror = () => {
          console.error('N8nDemo: Failed to load script:', src);
          reject(new Error(`Failed to load ${src}`));
        };
        document.head.appendChild(script);
      });
    };

    const loadScripts = async () => {
      try {
        // Try multiple CDN sources for better reliability
        const sources = [
          {
            webcomponents:
              'https://cdn.jsdelivr.net/npm/@webcomponents/webcomponentsjs@2.8.0/webcomponents-loader.min.js',
            n8nDemo:
              'https://cdn.jsdelivr.net/npm/@n8n_io/n8n-demo-component@latest/n8n-demo.bundled.js',
          },
          {
            webcomponents:
              'https://unpkg.com/@webcomponents/webcomponentsjs@2.8.0/webcomponents-loader.min.js',
            n8nDemo: 'https://unpkg.com/@n8n_io/n8n-demo-component@latest/n8n-demo.bundled.js',
          },
          {
            webcomponents: 'https://n8n-io.github.io/n8n-demo-webcomponent/webcomponents-loader.js',
            n8nDemo: 'https://n8n-io.github.io/n8n-demo-webcomponent/n8n-demo.bundled.js',
          },
        ];

        let loaded = false;

        // Try each source until one works
        for (const source of sources) {
          if (loaded) break;

          try {
            console.log('N8nDemo: Trying source:', source);
            await loadScript(source.webcomponents);
            await loadScript(source.n8nDemo, 'module');
            loaded = true;
            console.log('N8nDemo: Successfully loaded from source:', source);
          } catch (error) {
            console.warn('N8nDemo: Failed to load from source, trying next:', error);
          }
        }

        if (!loaded) {
          throw new Error('Failed to load n8n-demo component from any source');
        }

        console.log('N8nDemo: All scripts loaded successfully');
        setScriptsLoaded(true);

        // Wait a bit to ensure the component is registered, but only set it once
        let retries = 0;
        const checkComponentReady = () => {
          if (customElements.get('n8n-demo')) {
            console.log('N8nDemo: Component registered, setting ready');
            setComponentReady(true);
          } else if (retries < 10) {
            retries++;
            setTimeout(checkComponentReady, 100);
          } else {
            console.warn('N8nDemo: Component not registered after 1s, setting ready anyway');
            setComponentReady(true);
          }
        };
        setTimeout(checkComponentReady, 100);
      } catch (error) {
        console.error('N8nDemo: Error loading scripts:', error);
        setError('Failed to load workflow preview components');
        // Still mark as loaded to show the error UI
        setScriptsLoaded(true);
      }
    };

    loadScripts();
  }, []);

  // Create a simpler preview component when the web component fails to load
  const renderFallbackPreview = () => {
    if (!workflow) return null;

    // Try to get nodes from the workflow
    let nodes: any[] = [];
    try {
      const workflowObj = typeof workflow === 'string' ? JSON.parse(workflow) : workflow;
      nodes = workflowObj.nodes || [];
    } catch (e) {
      console.error('Error parsing workflow for fallback preview:', e);
    }

    return (
      <div className='h-full w-full bg-gray-800 p-4 overflow-auto'>
        <div className='mb-4'>
          <h3 className='text-lg font-medium text-white'>Workflow Preview (Simple Mode)</h3>
          <p className='text-sm text-gray-400'>
            Web component failed to load. Showing simplified preview.
          </p>
        </div>

        <div className='space-y-4'>
          {nodes.map((node, index) => (
            <div key={index} className='bg-gray-700 rounded-lg p-4 border border-gray-600'>
              <div className='flex items-center justify-between mb-2'>
                <span className='text-white font-medium'>{node.name}</span>
                <span className='bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded'>
                  {node.type.split('.').pop()}
                </span>
              </div>
              {node.parameters && Object.keys(node.parameters).length > 0 && (
                <div className='mt-2'>
                  <p className='text-gray-400 text-xs mb-1'>Parameters:</p>
                  <div className='bg-gray-800 p-2 rounded text-xs text-gray-300 font-mono'>
                    {Object.entries(node.parameters).map(([key, value]: [string, any]) => (
                      <div key={key}>
                        <span className='text-blue-300'>{key}:</span> {JSON.stringify(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {nodes.length === 0 && (
            <div className='text-center py-8 text-gray-400'>
              <p>No nodes found in workflow</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Memoize workflow JSON to prevent unnecessary re-renders
  const workflowJson = useMemo(() => {
    if (!workflow) return null;

    try {
      if (typeof workflow === 'string') {
        // Validate it's valid JSON by parsing and re-stringifying
        const parsed = JSON.parse(workflow);
        return JSON.stringify(parsed);
      } else {
        // Otherwise stringify the object
        return JSON.stringify(workflow);
      }
    } catch (error) {
      console.error('N8nDemo: Error stringifying workflow:', error);
      return JSON.stringify({
        name: 'Error Workflow',
        nodes: [],
        connections: {},
      });
    }
  }, [workflow]);

  // Only recreate the n8n-demo element when workflow content actually changes
  useEffect(() => {
    if (!componentReady || !containerRef.current || !workflowJson) {
      return;
    }

    // Check if workflow content actually changed
    if (workflowRef.current === workflowJson) {
      console.log('N8nDemo: Workflow content unchanged, skipping recreate');
      return;
    }

    workflowRef.current = workflowJson;
    console.log('N8nDemo: Workflow content changed, recreating element');

    try {
      // Log the nodes for debugging
      const workflowObj = JSON.parse(workflowJson);
      console.log('N8nDemo: Workflow nodes:', workflowObj.nodes?.length || 0, 'nodes');
      if (workflowObj.nodes?.length > 0) {
        console.log('N8nDemo: First node:', workflowObj.nodes[0]);
      }

      // Check if the custom element is defined
      if (!customElements.get('n8n-demo')) {
        console.error('N8nDemo: Custom element not defined');
        setError('n8n-demo component not available');
        return;
      }

      // Always recreate the element for reliable updates
      if (containerRef.current) {
        // Clear container
        containerRef.current.innerHTML = '';

        // Create n8n-demo element
        const demoElement = document.createElement('n8n-demo');
        demoElementRef.current = demoElement;

        // Set workflow as attribute (using the memoized JSON)
        demoElement.setAttribute('workflow', workflowJson);
        console.log('N8nDemo: Set workflow attribute', {
          workflowLength: workflowJson.length,
          preview: workflowJson.substring(0, 100),
          hasNodes: workflowJson.includes('"nodes"'),
          hasConnections: workflowJson.includes('"connections"')
        });

        // Set additional attributes that might be needed
        demoElement.setAttribute('frame', showFrame ? 'true' : 'false');
        // Disable collapse on mobile so workflow shows immediately
        demoElement.setAttribute('collapseformobile', 'false');
        // Enable zoom-to-fit for mobile
        demoElement.setAttribute('zoomtofit', 'true');
        // Set theme
        demoElement.setAttribute('theme', 'dark');
        demoElement.setAttribute('data-theme', 'dark');

        // Get container height in pixels for proper sizing
        const containerHeight = containerRef.current.clientHeight;

        // Set styles to fully stretch
        demoElement.style.width = '100%';
        demoElement.style.height = '100%';
        demoElement.style.minHeight = '100%';
        demoElement.style.display = 'block';
        // Only remove border/radius if frame is disabled
        if (!showFrame) {
          demoElement.style.border = 'none';
          demoElement.style.borderRadius = '0px';
        }
        demoElement.style.overflow = 'hidden';
        demoElement.style.position = 'absolute';
        demoElement.style.top = '0';
        demoElement.style.left = '0';
        // Force black background on the element itself - CSS will handle the rest
        demoElement.style.setProperty('background', '#000000', 'important');
        demoElement.style.setProperty('background-color', '#000000', 'important');
        demoElement.style.setProperty('color-scheme', 'dark', 'important');

        // CSS custom properties for n8n-demo web component styling
        // These properties penetrate the Shadow DOM to style the internal iframe
        demoElement.style.setProperty('--n8n-frame-background-color', '#000000');
        demoElement.style.setProperty('--n8n-json-background-color', '#111111');
        demoElement.style.setProperty('--n8n-copy-button-background-color', '#1f2937');
        demoElement.style.setProperty('--n8n-workflow-min-height', `${containerHeight}px`);
        demoElement.style.setProperty('--n8n-iframe-border-radius', '0px');

        // Add zoom-to-fit styles for mobile
        demoElement.style.setProperty('transform-origin', '0 0');
        demoElement.style.setProperty('object-fit', 'contain');

        // Add error handling
        demoElement.addEventListener('error', e => {
          console.warn('N8nDemo: Component error:', e);
          setError('Workflow preview failed to load');
        });

        // Append to container
        containerRef.current.appendChild(demoElement);
        console.log('N8nDemo: Element created and appended with height:', containerHeight);
      }
    } catch (error) {
      console.error('N8nDemo: Error creating demo element:', error);
      setError('Failed to create workflow preview');
    }
  }, [workflowJson, componentReady]);

  // Add ResizeObserver to update height dynamically when container resizes
  useEffect(() => {
    if (!containerRef.current || !demoElementRef.current) return;

    let rafId: number | null = null;

    // Use requestAnimationFrame for smooth updates
    const updateHeight = (height: number) => {
      // Skip updates while dragging for better performance
      if (isDragging) return;

      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        if (demoElementRef.current && height > 0) {
          demoElementRef.current.style.setProperty('--n8n-workflow-min-height', `${height}px`);
        }
        rafId = null;
      });
    };

    // Create resize observer
    resizeObserverRef.current = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        updateHeight(height);
      }
    });

    // Observe the container
    resizeObserverRef.current.observe(containerRef.current);

    // Cleanup
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [componentReady, isDragging]);

  // Show error state
  if (error) {
    return <div className='h-full w-full'>{renderFallbackPreview()}</div>;
  }

  return (
    <div className='h-full w-full relative overflow-hidden'>
      {/* Show loading state while scripts are loading */}
      {!componentReady && (
        <div className='flex items-center justify-center h-full bg-black'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2'></div>
            <p className='text-white text-sm'>
              Loading workflow preview...
              {scriptsLoaded && (
                <span className='block text-xs mt-1 text-white/70'>
                  Scripts loaded, waiting for component
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Container for n8n-demo element - Absolute positioning ensures full coverage with zoom to fit */}
      <div
        ref={containerRef}
        className='absolute inset-0 w-full h-full'
        style={{
          display: componentReady ? 'block' : 'none',
          touchAction: 'pan-x pan-y pinch-zoom',
          willChange: isDragging ? 'height' : 'auto',
          transform: 'translateZ(0)', // Force GPU acceleration
          backfaceVisibility: 'hidden', // Prevent flickering
        }}
      />
    </div>
  );
}
