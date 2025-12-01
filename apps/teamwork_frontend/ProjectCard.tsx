import React from 'react';
import { Project } from '../types';
import { Clock, List, ArrowRight } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick }) => {
  const totalTasks = project.stages.reduce((acc, stage) => acc + stage.tasks.length, 0);
  
  return (
    <div 
      onClick={() => onClick(project)}
      className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
          <List size={20} />
        </div>
        <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <Clock size={12} /> {new Date(project.lastUpdated).toLocaleDateString()}
        </span>
      </div>
      
      <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
        {project.name}
      </h3>
      <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
        {project.description}
      </p>
      
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden">
                {[1,2,3].map(i => (
                    <img key={i} className="inline-block h-6 w-6 rounded-full ring-2 ring-white" src={`https://picsum.photos/seed/${project.id}${i}/30/30`} alt=""/>
                ))}
            </div>
            <span className="text-xs text-gray-500 font-medium">{totalTasks} tasks</span>
        </div>
        <div className="bg-gray-50 p-2 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
             <ArrowRight size={16} />
        </div>
      </div>
    </div>
  );
};
